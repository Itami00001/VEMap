import logging
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)
Messages = list[dict[str, str]]


class ProviderStatus(BaseModel):
    id: str
    label: str
    available: bool
    reason: str | None = None
    model: str
    accepts_personal_key: bool = False


@dataclass(frozen=True)
class Completion:
    text: str
    model: str


def model_label(model: str) -> str:
    short = model.rstrip("/").split("/")
    return short[-2] if len(short) > 1 and short[-1] in {"latest", "rc", "deprecated"} else short[-1]


@dataclass(frozen=True)
class ChatProvider:
    label: str
    key: str
    model: str
    generate: Callable[[str, str, Messages], Completion]
    missing_setting: str | None = None

    @property
    def unavailable_reason(self) -> str | None:
        if self.missing_setting:
            return f"Не задана настройка {self.missing_setting}."
        if not self.model:
            return "Не задана модель."
        return None


def request_completion(url: str, headers: dict[str, str], payload: dict, *, timeout: float = 65) -> dict:
    response = httpx.post(url, headers=headers, json=payload, timeout=httpx.Timeout(timeout, connect=10))
    response.raise_for_status()
    return response.json()


def groq_completion(key: str, model: str, messages: Messages) -> Completion:
    payload = {"model": model, "messages": messages, "max_completion_tokens": 640}
    if model == "qwen/qwen3.8-27b":
        payload["reasoning_effort"] = "none"
    result = request_completion(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {key}"},
        payload,
    )
    return Completion(result["choices"][0]["message"]["content"], model_label(result.get("model") or model))


def local_completion(url: str, model: str, messages: Messages) -> Completion:
    result = request_completion(f"{url.rstrip('/')}/v1/chat/completions", {}, {
        "model": model, "messages": messages, "max_tokens": 224, "temperature": 0.2,
    }, timeout=95)
    return Completion(result["choices"][0]["message"]["content"], model_label(result.get("model") or model))


def google_completion(key: str, model: str, messages: Messages) -> Completion:
    result = request_completion(
        f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent",
        {"x-goog-api-key": key},
        {
            "systemInstruction": {"parts": [{"text": messages[0]["content"]}]},
            "contents": [
                {"role": "model" if message["role"] == "assistant" else "user",
                 "parts": [{"text": message["content"]}]}
                for message in messages[1:]
            ],
            "generationConfig": {"maxOutputTokens": 1024},
        },
    )
    text = "".join(
        part.get("text", "") for part in result["candidates"][0]["content"]["parts"]
        if not part.get("thought")
    )
    return Completion(text, model_label(result.get("modelVersion") or model))


def yandex_completion(key: str, model: str, messages: Messages) -> Completion:
    result = request_completion(
        "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
        {"Authorization": f"Api-Key {key}"},
        {
            "modelUri": model,
            "completionOptions": {"stream": False, "maxTokens": "640"},
            "messages": [{"role": message["role"], "text": message["content"]} for message in messages],
        },
    )
    return Completion(result["result"]["alternatives"][0]["message"]["text"], model_label(model))


def chat_providers() -> dict[str, ChatProvider]:
    groq_key = settings.GROQ_API_KEY.get_secret_value().strip()
    yandex_key = settings.YANDEX_API_KEY.get_secret_value().strip()
    google_key = settings.GOOGLE_API_KEY.get_secret_value().strip()
    folder = settings.YANDEX_FOLDER_ID.strip()
    yandex_model = settings.YANDEX_MODEL.strip()
    url = settings.LOCAL_LLM_URL.strip()
    providers = {
        "local": ChatProvider("Локальная модель VEMap", url, settings.LOCAL_LLM_MODEL.strip(), local_completion,
                              None if url else "LOCAL_LLM_URL"),
    }
    if not settings.CHAT_ALLOW_CLOUD:
        return providers
    return {
        **providers,
        "groq": ChatProvider("Groq", groq_key, settings.GROQ_MODEL.strip(), groq_completion,
                             None if groq_key else "GROQ_API_KEY"),
        "yandex": ChatProvider("Yandex AI Studio", yandex_key,
                               f"gpt://{folder}/{yandex_model}" if yandex_model else "", yandex_completion,
                               ("YANDEX_FOLDER_ID" if not folder else None) if yandex_key else "YANDEX_API_KEY"),
        "google": ChatProvider("Google AI Studio", google_key, settings.GOOGLE_MODEL.strip(), google_completion,
                               None if google_key else "GOOGLE_API_KEY"),
    }


def generate_answer(provider_id: str, provider: ChatProvider, messages: Messages) -> Completion:
    try:
        result = provider.generate(provider.key, provider.model, messages)
        if isinstance(result.text, str) and result.text.strip():
            return Completion(result.text.strip(), result.model)
        raise ValueError("Empty reply")
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.warning("Chat provider=%s upstream_status=%d", provider_id, status)
        if status == 429:
            delay = exc.response.headers.get("Retry-After")
            raise HTTPException(429, f"{provider.label}: превышен лимит запросов или токенов.",
                                headers={"Retry-After": delay} if delay else None) from exc
        if status == 402:
            raise HTTPException(402, f"{provider.label}: проверьте баланс и тариф.") from exc
        if status in (401, 403):
            raise HTTPException(503, f"{provider.label}: проверьте ключ, права доступа и регион проекта.") from exc
        if status == 404:
            raise HTTPException(503, f"{provider.label}: выбранная модель недоступна.") from exc
        if status in (400, 413, 422):
            raise HTTPException(503, f"{provider.label} отклонил запрос. Проверьте модель или сократите вопрос.") from exc
        raise HTTPException(503, f"{provider.label} временно недоступен.") from exc
    except httpx.TimeoutException as exc:
        logger.warning("Chat timeout provider=%s type=%s", provider_id, type(exc).__name__)
        raise HTTPException(504, f"{provider.label} не успел ответить.") from exc
    except httpx.RequestError as exc:
        logger.warning("Chat connection failed provider=%s type=%s", provider_id, type(exc).__name__)
        raise HTTPException(503, f"Не удалось подключиться к {provider.label}.") from exc
    except (ValueError, KeyError, TypeError, IndexError, AttributeError) as exc:
        logger.warning("Invalid chat response provider=%s type=%s", provider_id, type(exc).__name__)
        raise HTTPException(503, f"{provider.label} вернул пустой или некорректный ответ.") from exc
