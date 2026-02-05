"""Integration tests for auth dependencies. Step 2.1 - get_current_user_required raises 401."""
import os

from fastapi import APIRouter, Depends
from starlette.testclient import TestClient

from app.auth.dependencies import get_current_user_required
from app.core.config import Settings
from app.core.factory import create_app
from app.models.user import User

# Minimal router to test get_current_user_required
_router = APIRouter()


@_router.get("/test-protected")
async def _protected_route(user: User = Depends(get_current_user_required)) -> dict:
    """Protected route for testing."""
    return {"user_id": str(user.id)}


def _minimal_settings() -> Settings:
    """Settings with required fields."""
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


def test_get_current_user_required_returns_401_when_no_token() -> None:
    """GET protected route without token returns 401."""
    app = create_app(_minimal_settings())
    app.include_router(_router)
    with TestClient(app) as client:
        response = client.get("/test-protected")
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_get_current_user_required_returns_401_when_invalid_token() -> None:
    """GET protected route with invalid token returns 401."""
    app = create_app(_minimal_settings())
    app.include_router(_router)
    with TestClient(app) as client:
        response = client.get(
            "/test-protected",
            headers={"Authorization": "Bearer invalid-token"},
        )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"
