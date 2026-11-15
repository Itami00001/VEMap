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


settings = Settings()
