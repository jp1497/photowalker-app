"""Integration tests for health check endpoints. Step 1.4 - Definition of Done."""
import os

from starlette.testclient import TestClient

from app.core.config import Settings
from app.core.factory import create_app
from tests.conftest import requires_postgres


def _minimal_settings() -> Settings:
    """Settings with required fields for testing."""
    return Settings(
        database_url=os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        ),
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
    )


def test_health_returns_200() -> None:
    """GET /health returns 200 and status healthy."""
    app = create_app(_minimal_settings())
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@requires_postgres
def test_health_db_returns_200_when_connected() -> None:
    """GET /health/db returns 200 when DB is connected."""
    app = create_app(_minimal_settings())
    with TestClient(app) as client:
        response = client.get("/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_health_db_returns_503_when_db_unavailable() -> None:
    """GET /health/db returns 503 when DB is unreachable."""
    settings = Settings(
        database_url="postgresql+asyncpg://none:none@127.0.0.1:19999/none",
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.get("/health/db")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["database"] == "disconnected"
    assert "error" in data


def test_health_storage_returns_200_or_503() -> None:
    """GET /health/storage returns 200 (S3 ok) or 503 (S3 unreachable/not configured)."""
    app = create_app(_minimal_settings())
    with TestClient(app) as client:
        response = client.get("/health/storage")
    assert response.status_code in (200, 503)
    data = response.json()
    assert data["status"] in ("healthy", "unhealthy")
    if response.status_code == 200:
        assert data.get("storage") == "connected"
    else:
        assert data.get("storage") == "disconnected"
        assert "error" in data
