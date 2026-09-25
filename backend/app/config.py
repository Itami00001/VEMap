from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://mapmood:mapmood@localhost:5432/mapmood"
    JWT_SECRET: str = "change-me-in-production"
    ADMIN_EMAIL: str = "admin@mapmood.local"
    ADMIN_PASSWORD: str = "changeme"


settings = Settings()
