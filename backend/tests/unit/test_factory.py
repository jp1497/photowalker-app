"""Unit tests for app.core.factory."""
from app.core.config import Settings
from app.core.factory import create_app


def _minimal_settings(environment: str = "development") -> Settings:
    """Build Settings with required fields for testing."""
    return Settings(
        database_url="postgresql+asyncpg://localhost/test",
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
        environment=environment,
    )


def test_create_app_returns_fastapi_instance() -> None:
    """create_app returns a FastAPI application instance."""
    settings = _minimal_settings()
    app = create_app(settings)
    assert app.title == "Photowalker API"
    assert app.version == "1.0.0"


def test_create_app_docs_enabled_in_development() -> None:
    """In development, docs and redoc URLs are set."""
    settings = _minimal_settings(environment="development")
    app = create_app(settings)
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"


def test_create_app_docs_disabled_in_production() -> None:
    """In production, docs and redoc are disabled."""
    settings = _minimal_settings(environment="production")
    app = create_app(settings)
    assert app.docs_url is None
    assert app.redoc_url is None
