from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://mapmood:mapmood@localhost:5432/mapmood"
    JWT_SECRET: str
    ADMIN_EMAIL: str = "admin@mapmood.local"
    ADMIN_PASSWORD: str


settings = Settings()
