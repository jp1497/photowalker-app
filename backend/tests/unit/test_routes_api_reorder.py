"""Unit tests for PUT /v1/routes/{route_id}/photos/order."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user_required
from app.core.config import Settings, get_settings
from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.core.factory import create_app
from app.db.dependencies import get_db
from app.models.user import User


def _minimal_settings() -> Settings:
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
    )


@pytest.fixture()
def client():
    settings = _minimal_settings()
    app = create_app(settings)

    async def _mock_db():
        session = MagicMock()
        session.commit = AsyncMock()
        yield session

    app.dependency_overrides[get_db] = _mock_db
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


def test_reorder_photos_unauthenticated_returns_401(client: TestClient) -> None:
    """PUT /v1/routes/{id}/photos/order returns 401 with no auth."""
    route_id = uuid4()
    resp = client.put(f"/v1/routes/{route_id}/photos/order", json={"photo_ids": []})
    assert resp.status_code == 401


def test_reorder_photos_returns_404_when_route_not_found(client: TestClient) -> None:
    """PUT /v1/routes/{id}/photos/order returns 404 when route does not exist."""
    fake_user = User(id=uuid.uuid4(), google_id="g1", email="u@test.com", name="Test")
    app = client.app
    app.dependency_overrides[get_current_user_required] = lambda: fake_user
    try:
        with patch(
            "app.services.route_service.reorder_route_photos", new_callable=AsyncMock
        ) as mock_reorder:
            mock_reorder.side_effect = RouteNotFoundError()
            resp = client.put(
                f"/v1/routes/{uuid.uuid4()}/photos/order", json={"photo_ids": []}
            )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.pop(get_current_user_required, None)


def test_reorder_photos_returns_403_when_forbidden(client: TestClient) -> None:
    """PUT /v1/routes/{id}/photos/order returns 403 when user is not the route owner."""
    fake_user = User(id=uuid.uuid4(), google_id="g2", email="u@test.com", name="Test")
    app = client.app
    app.dependency_overrides[get_current_user_required] = lambda: fake_user
    try:
        with patch(
            "app.services.route_service.reorder_route_photos", new_callable=AsyncMock
        ) as mock_reorder:
            mock_reorder.side_effect = RouteForbiddenError()
            resp = client.put(
                f"/v1/routes/{uuid.uuid4()}/photos/order", json={"photo_ids": []}
            )
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user_required, None)


def test_reorder_photos_returns_400_when_invalid_photo_ids(client: TestClient) -> None:
    """PUT /v1/routes/{id}/photos/order returns 400 when photo_ids are invalid."""
    fake_user = User(id=uuid.uuid4(), google_id="g3", email="u@test.com", name="Test")
    app = client.app
    app.dependency_overrides[get_current_user_required] = lambda: fake_user
    try:
        with patch(
            "app.services.route_service.reorder_route_photos", new_callable=AsyncMock
        ) as mock_reorder:
            mock_reorder.side_effect = ValueError("photo_ids do not match route photos")
            resp = client.put(
                f"/v1/routes/{uuid.uuid4()}/photos/order", json={"photo_ids": []}
            )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_current_user_required, None)
