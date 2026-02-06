"""Integration tests for auth API endpoints. Step 2.2 - Definition of Done."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from starlette.testclient import TestClient

from app.core.config import get_settings
from app.core.factory import create_app
from app.services.auth_service import issue_tokens
from tests.conftest import _minimal_settings, requires_postgres


def _fake_user():
    """Fake user for mocking OAuth exchange."""
    return SimpleNamespace(
        id=uuid4(),
        email="test@example.com",
        name="Test User",
        avatar_url="https://example.com/avatar.jpg",
        created_at=datetime.now(timezone.utc),
    )


@requires_postgres
def test_post_auth_google_with_valid_mock_code_returns_200_and_user() -> None:
    """POST /v1/auth/google with valid mock code returns 200 and user."""
    app = create_app(_minimal_settings())
    fake = _fake_user()
    with patch(
        "app.api.v1.auth.exchange_code_for_user",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        with TestClient(app) as client:
            response = client.post(
                "/v1/auth/google",
                json={"code": "valid-mock-code"},
            )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "user" in data
    assert data["user"]["email"] == fake.email
    assert data["user"]["name"] == fake.name
    assert response.cookies.get("refresh_token") is not None


@requires_postgres
def test_post_auth_google_with_invalid_code_returns_400() -> None:
    """POST /v1/auth/google with invalid code returns 400."""
    app = create_app(_minimal_settings())
    with patch(
        "app.api.v1.auth.exchange_code_for_user",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with TestClient(app) as client:
            response = client.post(
                "/v1/auth/google",
                json={"code": "invalid-code"},
            )
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "OAUTH_ERROR"


@requires_postgres
def test_get_auth_me_without_token_returns_401() -> None:
    """GET /v1/auth/me without token returns 401."""
    app = create_app(_minimal_settings())
    with TestClient(app) as client:
        response = client.get("/v1/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@requires_postgres
def test_get_auth_me_with_valid_token_returns_200_and_user() -> None:
    """GET /v1/auth/me with valid token returns 200 and user."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    fake = _fake_user()
    access_token, _ = issue_tokens(settings, fake.id)
    try:
        with patch(
            "app.auth.dependencies.get_user_by_id",
            new_callable=AsyncMock,
            return_value=fake,
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/v1/auth/me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == fake.email
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_auth_test_login_with_secret_returns_200_and_tokens() -> None:
    """POST /v1/auth/test-login with correct E2E secret returns 200 and tokens (E2E only)."""
    settings = _minimal_settings()
    settings.e2e_test_secret = "e2e-secret-123"
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.post(
                "/v1/auth/test-login",
                json={"secret": "e2e-secret-123"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "e2e-test@photowalker.local"
        assert response.cookies.get("refresh_token") is not None
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_auth_test_login_with_wrong_secret_returns_404() -> None:
    """POST /v1/auth/test-login with wrong secret returns 404."""
    settings = _minimal_settings()
    settings.e2e_test_secret = "e2e-secret-123"
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.post(
                "/v1/auth/test-login",
                json={"secret": "wrong"},
            )
        assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_auth_logout_clears_refresh_cookie() -> None:
    """POST /v1/auth/logout clears refresh cookie."""
    app = create_app(_minimal_settings())
    fake = _fake_user()
    with patch(
        "app.api.v1.auth.exchange_code_for_user",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        with TestClient(app) as client:
            login_resp = client.post(
                "/v1/auth/google",
                json={"code": "valid-mock-code"},
            )
            assert login_resp.cookies.get("refresh_token") is not None
            logout_resp = client.post("/v1/auth/logout")
    assert logout_resp.status_code == 200
    assert logout_resp.json()["message"] == "Logged out"
    set_cookie = logout_resp.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "max-age=0" in set_cookie or "expires=" in set_cookie.lower()
