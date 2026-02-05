"""Unit tests for app.core.config."""
import pytest

from app.core.config import Settings, get_settings


def test_settings_load_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings loads from environment variables."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/test")
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost/callback")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "ak")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "sk")
    monkeypatch.setenv("S3_BUCKET_NAME", "bucket")
    monkeypatch.setenv("ENVIRONMENT", "staging")
    get_settings.cache_clear()
    try:
        settings = get_settings()
        assert settings.database_url == "postgresql+asyncpg://localhost/test"
        assert settings.secret_key == "test-secret"
        assert settings.environment == "staging"
    finally:
        get_settings.cache_clear()


def test_settings_defaults() -> None:
    """Default values are correct when required env is provided via constructor."""
    settings = Settings(
        database_url="postgresql+asyncpg://localhost/db",
        secret_key="key",
        google_client_id="c",
        google_client_secret="s",
        google_redirect_uri="http://localhost/cb",
        aws_access_key_id="ak",
        aws_secret_access_key="sk",
        s3_bucket_name="b",
        redis_url=None,  # Explicit override; default when not configured
    )
    assert settings.environment == "development"
    assert settings.debug is False
    assert settings.api_version == "v1"
    assert settings.database_pool_size == 5
    assert settings.database_max_overflow == 5
    assert settings.database_pool_timeout == 30
    assert settings.database_pool_recycle == 3600
    assert settings.jwt_algorithm == "HS256"
    assert settings.jwt_access_token_expire_minutes == 15
    assert settings.frontend_url == "http://localhost:5173"
    assert settings.redis_url is None
