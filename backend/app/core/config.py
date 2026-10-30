import secrets
import warnings
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / backend/.env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Public Grievance AI Assistant"
    API_V1_STR: str = "/api/v1"

    # ``production`` enables strict guards (no SQLite, no ephemeral JWT key).
    ENVIRONMENT: str = "development"

    # Database. SQLite is used for local development; set DATABASE_URL to a
    # Supabase PostgreSQL connection string in production.
    DATABASE_URL: str = "sqlite:///./grievance_dev.db"

    # JWT & Auth
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # AI - Gemini (backend only; never exposed to the browser)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 5

    # Admin bootstrap. No default credentials are shipped: an administrator is
    # only created when both variables are explicitly provided.
    ADMIN_BOOTSTRAP_EMAIL: str = ""
    ADMIN_BOOTSTRAP_PASSWORD: str = ""
    ADMIN_BOOTSTRAP_NAME: str = "System Administrator"

    @model_validator(mode="after")
    def _validate_settings(self) -> "Settings":
        is_production = self.ENVIRONMENT.strip().lower() == "production"

        if is_production:
            # A random per-process key would invalidate every session on each
            # restart, and SQLite cannot back a multi-instance deployment.
            if len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be set to at least 32 characters when "
                    "ENVIRONMENT=production"
                )
            if self.DATABASE_URL.strip().lower().startswith("sqlite"):
                raise ValueError(
                    "DATABASE_URL must point to PostgreSQL when "
                    "ENVIRONMENT=production"
                )

        if not self.JWT_SECRET_KEY:
            # Ephemeral fallback keeps local development runnable without a
            # committed secret. Tokens are invalidated when the process restarts.
            self.JWT_SECRET_KEY = secrets.token_urlsafe(48)
            warnings.warn(
                "JWT_SECRET_KEY is not set. Generated an ephemeral development key; "
                "set JWT_SECRET_KEY in backend/.env for stable sessions.",
                RuntimeWarning,
                stacklevel=2,
            )

        if self.ADMIN_BOOTSTRAP_PASSWORD and len(self.ADMIN_BOOTSTRAP_PASSWORD) < 8:
            raise ValueError("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters long")

        return self


settings = Settings()
