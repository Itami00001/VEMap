from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://mapmood:mapmood@localhost:5432/mapmood"
    JWT_SECRET: str
    ADMIN_EMAIL: str = "admin@mapmood.local"
    ADMIN_PASSWORD: str
    GROQ_API_KEY: SecretStr = SecretStr("")
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    YANDEX_API_KEY: SecretStr = SecretStr("")
    YANDEX_FOLDER_ID: str = ""
    YANDEX_MODEL: str = "yandexgpt/latest"
    GOOGLE_API_KEY: SecretStr = SecretStr("")
    GOOGLE_MODEL: str = "gemini-3.5-flash-lite"
    CHAT_ALLOW_CLOUD: bool = True
    LOCAL_LLM_URL: str = ""
    LOCAL_LLM_MODEL: str = "Qwen2.5-1.5B-Instruct"
    WIKI_TELEGRAM_TOKEN: SecretStr = SecretStr("")
    WIKI_TELEGRAM_CHAT_ID: int = 0
    WIKI_STORAGE_DIR: str = "/app/storage/wiki"
    WIKI_TRUST_PROXY: bool = False
    WIKI_PROCESSOR: list[str] = []
    WIKI_OCR_COMMAND: list[str] = []
    WIKI_PROCESSOR_TIMEOUT: int = 1800


settings = Settings()
