from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

    app_env: str = "development"
    app_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:8000,http://localhost:5500,http://127.0.0.1:5500"

    database_url: str = "postgresql+psycopg://vagai:vagai@localhost:5432/vagai_silambam"

    jwt_secret: str = "insecure-development-secret-change-me"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 14

    token_encryption_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/google/callback"

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    trial_days: int = 14

    @property
    def normalized_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def cors_origin_list(self) -> list[str]:
        defaults = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "https://silambam.dodoxtechs.in",
            "https://vagai-silambam-app.vercel.app",
        ]
        from_env = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return list(set(defaults + from_env))


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.jwt_secret.startswith("insecure"):
        raise RuntimeError("JWT_SECRET must be set in production")
    return settings
