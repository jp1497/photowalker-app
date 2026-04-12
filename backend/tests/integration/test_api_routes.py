"""Integration tests for route API endpoints."""
from __future__ import annotations

import asyncio
from uuid import uuid4

from starlette.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.factory import create_app
from app.db.session import create_engine, create_session_factory
from app.models.user import User
from app.services.auth_service import issue_tokens
from tests.conftest import _minimal_settings, requires_postgres
from tests.integration.helpers import create_route_sync as _create_route_sync
from tests.integration.test_api_photos import MINIMAL_JPEG, _photo_settings


async def _create_user_and_token(settings: Settings) -> tuple[User, str]:
    """Create a user in the DB and return (user, access_token)."""
    from sqlalchemy import text

    from app.db.base import Base

    uid = uuid4().hex[:8]
    engine = create_engine(settings)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(lambda c: Base.metadata.create_all(c))
    session_factory = create_session_factory(engine)
    async with session_factory() as session:
        user = User(
            google_id=f"routes-test-{uid}",
            email=f"routes-{uid}@test.com",
            name="Routes Test",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = issue_tokens(settings, user.id)[0]
    await engine.dispose()
    return user, token


def _create_user_and_token_sync(settings: Settings) -> tuple[User, str]:
    return asyncio.run(_create_user_and_token(settings))



@requires_postgres
def test_get_routes_me_returns_user_routes() -> None:
    """GET /v1/routes/me returns current user's routes."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        _create_route_sync(settings, user.id, title="Test Walk", is_public=True, tags=["urban", "test"])
        with TestClient(app) as client:
            me_resp = client.get("/v1/routes/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        data = me_resp.json()
        assert "routes" in data
        routes = data["routes"]
        assert len(routes) == 1
        assert routes[0]["title"] == "Test Walk"
        assert routes[0]["user_id"] == str(user.id)
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_me_without_auth_returns_401() -> None:
    """GET /v1/routes/me without auth returns 401."""
    settings = _minimal_settings()
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.get("/v1/routes/me")
    assert response.status_code == 401


@requires_postgres
def test_get_routes_slug_returns_route_for_public_route() -> None:
    """GET /v1/routes/{slug} returns route for public route."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        route = _create_route_sync(settings, user.id, slug="public-route-slug", is_public=True)
        with TestClient(app) as client:
            get_resp = client.get(f"/v1/routes/{route.slug}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert "route" in data
        assert "photos" in data
        assert data["route"]["slug"] == route.slug
        assert data["route"]["is_public"] is True
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_slug_returns_403_for_private_route_when_not_owner() -> None:
    """GET /v1/routes/{slug} returns 403 for private route when not owner."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        route = _create_route_sync(settings, user1.id, slug="private-route", is_public=False)
        with TestClient(app) as client:
            get_resp = client.get(
                f"/v1/routes/{route.slug}",
                headers={"Authorization": f"Bearer {token2}"},
            )
        assert get_resp.status_code == 403
        assert get_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_slug_returns_404_for_invalid_slug() -> None:
    """GET /v1/routes/{slug} returns 404 for invalid slug."""
    settings = _minimal_settings()
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.get("/v1/routes/nonexistent-slug-xyz-123")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@requires_postgres
def test_patch_routes_id_by_non_owner_returns_403() -> None:
    """PATCH /v1/routes/{id} by non-owner returns 403."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        route = _create_route_sync(settings, user1.id, slug="owner-route-patch")
        with TestClient(app) as client:
            patch_resp = client.patch(
                f"/v1/routes/{route.id}",
                headers={"Authorization": f"Bearer {token2}"},
                json={"title": "Hacked"},
            )
        assert patch_resp.status_code == 403
        assert patch_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_delete_routes_id_by_non_owner_returns_403() -> None:
    """DELETE /v1/routes/{id} by non-owner returns 403."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        route = _create_route_sync(settings, user1.id, slug="owner-route-del")
        with TestClient(app) as client:
            del_resp = client.delete(
                f"/v1/routes/{route.id}",
                headers={"Authorization": f"Bearer {token2}"},
            )
        assert del_resp.status_code == 403
        assert del_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_slug_private_as_owner_returns_200() -> None:
    """GET /v1/routes/{slug} for private route as owner returns 200."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        route = _create_route_sync(settings, user.id, slug="my-private", is_public=False)
        with TestClient(app) as client:
            get_resp = client.get(
                f"/v1/routes/{route.slug}",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert get_resp.status_code == 200
        assert get_resp.json()["route"]["slug"] == route.slug
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_routes_from_photos_with_valid_data_returns_201() -> None:
    """POST /v1/routes/from-photos with valid data returns 201 (UAT-FR-R1.1)."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            # Different coordinates per photo so route distance > 0
            with patch(
                "app.services.photo_service.extract_gps",
                side_effect=[(37.8, -122.4), (37.81, -122.41)],
            ):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up1 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p1.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
                    up2 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p2.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
            assert up1.status_code == 201 and up2.status_code == 201
            id1 = up1.json()["photo"]["id"]
            id2 = up2.json()["photo"]["id"]
            response = client.post(
                "/v1/routes/from-photos",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Route From Photos",
                    "description": None,
                    "tags": [],
                    "is_public": False,
                    "photo_ids": [id1, id2],
                },
            )
        assert response.status_code == 201
        data = response.json()
        assert "route" in data
        route = data["route"]
        assert route["title"] == "Route From Photos"
        assert "slug" in route
        assert route["distance_meters"] > 0
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_routes_from_photos_with_photo_missing_location_returns_400() -> None:
    """POST /v1/routes/from-photos with photo missing location returns 400."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up1 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p1.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
            assert up1.status_code == 201
            id1 = up1.json()["photo"]["id"]
            up2 = client.post(
                "/v1/photos",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("p2.jpg", MINIMAL_JPEG, "image/jpeg")},
                data={"route_ids": "[]"},
            )
            assert up2.status_code == 201
            id2 = up2.json()["photo"]["id"]
            response = client.post(
                "/v1/routes/from-photos",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Route From Photos",
                    "description": None,
                    "tags": [],
                    "is_public": False,
                    "photo_ids": [id1, id2],
                },
            )
        assert response.status_code == 400
        body = response.json()
        assert "error" in body
        msg = body["error"].get("message", "")
        assert "location" in msg.lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_routes_from_photos_with_fewer_than_two_photos_returns_400() -> None:
    """POST /v1/routes/from-photos with <2 photos returns 400 (body validation).

    This app maps RequestValidationError to 400 in error_handler, not 422.
    """
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up1 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p1.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
            assert up1.status_code == 201
            id1 = up1.json()["photo"]["id"]
            response = client.post(
                "/v1/routes/from-photos",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Route From Photos",
                    "description": None,
                    "tags": [],
                    "is_public": False,
                    "photo_ids": [id1],
                },
            )
        assert response.status_code == 400
        assert response.json().get("error", {}).get("code") == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_settings, None)
