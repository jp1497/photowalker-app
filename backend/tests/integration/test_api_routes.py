"""Integration tests for route API endpoints. Step 3.2 - Definition of Done."""
import asyncio
from typing import Any
from uuid import uuid4

from starlette.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.factory import create_app
from app.db.session import create_engine, create_session_factory
from app.models.user import User
from app.services.auth_service import issue_tokens
from tests.conftest import _minimal_settings, requires_postgres


async def _create_user_and_token(settings: Settings) -> tuple[User, str]:
    """Create a user in the DB and return (user, access_token). Uses same DATABASE_URL as app."""
    from app.db.base import Base
    from sqlalchemy import text
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


def _valid_route_payload() -> dict[str, Any]:
    return {
        "title": "Test Walk",
        "description": "A test route",
        "route_geometry": {
            "type": "LineString",
            "coordinates": [[-122.4, 37.8], [-122.41, 37.81]],
        },
        "tags": ["urban", "test"],
        "is_public": True,
    }


@requires_postgres
def test_post_routes_creates_route_returns_201() -> None:
    """POST /v1/routes creates route, returns 201."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            response = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
        assert response.status_code == 201
        data = response.json()
        assert "route" in data
        route = data["route"]
        assert route["title"] == "Test Walk"
        assert "slug" in route
        assert route["slug"]
        assert route["is_public"] is True
        assert "tags" in route
        assert set(route["tags"]) == {"urban", "test"}
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_me_returns_user_routes() -> None:
    """GET /v1/routes/me returns current user's routes."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
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
def test_post_routes_without_auth_returns_401() -> None:
    """POST /v1/routes without auth returns 401."""
    settings = _minimal_settings()
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.post("/v1/routes", json=_valid_route_payload())
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@requires_postgres
def test_get_routes_slug_returns_route_for_public_route() -> None:
    """GET /v1/routes/{slug} returns route for public route."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json={**_valid_route_payload(), "slug": "public-route-slug", "is_public": True},
            )
            assert create_resp.status_code == 201
            slug = create_resp.json()["route"]["slug"]
            get_resp = client.get(f"/v1/routes/{slug}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert "route" in data
        assert "photos" in data
        assert data["route"]["slug"] == slug
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
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token1}"},
                json={**_valid_route_payload(), "slug": "private-route", "is_public": False},
            )
            assert create_resp.status_code == 201
            slug = create_resp.json()["route"]["slug"]
            get_resp = client.get(
                f"/v1/routes/{slug}",
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
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token1}"},
                json={**_valid_route_payload(), "slug": "owner-route-patch"},
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            patch_resp = client.patch(
                f"/v1/routes/{route_id}",
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
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token1}"},
                json={**_valid_route_payload(), "slug": "owner-route-del"},
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            del_resp = client.delete(
                f"/v1/routes/{route_id}",
                headers={"Authorization": f"Bearer {token2}"},
            )
        assert del_resp.status_code == 403
        assert del_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_slug_private_as_owner_returns_200() -> None:
    """GET /v1/routes/{slug} for private route as owner returns 200 (UAT-FR2.4)."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json={**_valid_route_payload(), "slug": "my-private", "is_public": False},
            )
            assert create_resp.status_code == 201
            slug = create_resp.json()["route"]["slug"]
            get_resp = client.get(
                f"/v1/routes/{slug}",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert get_resp.status_code == 200
        assert get_resp.json()["route"]["slug"] == slug
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_routes_invalid_geometry_returns_400() -> None:
    """POST /v1/routes with invalid geometry returns 400 (UAT-FR2.2)."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        payload = {
            **_valid_route_payload(),
            "route_geometry": {"type": "LineString", "coordinates": [[-122.4, 37.8], [-122.4, 37.8]]},
        }
        with TestClient(app) as client:
            response = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        assert response.status_code == 400
        assert "error" in response.json()
    finally:
        app.dependency_overrides.pop(get_settings, None)
