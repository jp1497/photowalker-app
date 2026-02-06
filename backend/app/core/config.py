"""Application configuration from environment. See PRD v2 - Environment Configuration."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Environment-based configuration using Pydantic BaseSettings."""

    # Application
    environment: str = "development"  # development, staging, production
    debug: bool = False
    api_version: str = "v1"

    # Database (PRD v2: pool 5-10, overflow 5, timeout 30s, recycle 3600s)
    database_url: str
    database_pool_size: int = 5
    database_max_overflow: int = 5
    database_pool_timeout: int = 30
    database_pool_recycle: int = 3600

    # Security
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    # Storage
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-east-1"
    s3_bucket_name: str
    # Local file storage for development when S3 not configured (e.g. ./local_uploads)
    local_storage_path: Optional[str] = None

    # Frontend (CORS)
    frontend_url: str = "http://localhost:5173"

    # Redis (optional, for thumbnail queue and scaling)
    redis_url: Optional[str] = None

    # Rate limiting (NFR4): req/min per IP, per authenticated user, uploads/min, routes/hour
    rate_limit_ip_per_minute: int = 100
    rate_limit_user_per_minute: int = 500
    rate_limit_uploads_per_minute: int = 10
    rate_limit_routes_per_hour: int = 5

    # E2E testing: when set, POST /v1/auth/test-login accepts this secret and returns tokens for a test user
    e2e_test_secret: Optional[str] = None

    model_config = {"env_file": ".env", "case_sensitive": False}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        import logging
        logging.getLogger("config").info("local_storage_path=%s", self.local_storage_path)

    @property
    def sync_database_url(self) -> str:
        """Database URL for sync drivers (e.g. psycopg2 in thumbnail worker)."""
        url = self.database_url
        if "+asyncpg" in url:
            return url.replace("+asyncpg", "+psycopg2", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance loaded from environment."""
    return Settings()
