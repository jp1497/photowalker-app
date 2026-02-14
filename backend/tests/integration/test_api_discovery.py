"""Integration tests for discovery API (GET /v1/routes browse). Step 5.2."""
import asyncio
from typing import List, Optional
from uuid import uuid4

from starlette.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.factory import create_app
from app.db.session import create_engine, create_session_factory
from app.models.user import User
from app.services.auth_service import issue_tokens
from tests.conftest import _minimal_settings, requires_postgres


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
            google_id=f"discovery-test-{uid}",
            email=f"discovery-{uid}@test.com",
            name="Discovery Test",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = issue_tokens(settings, user.id)[0]
    await engine.dispose()
    return user, token


def _create_user_and_token_sync(settings: Settings) -> tuple[User, str]:
    return asyncio.run(_create_user_and_token(settings))


def _public_route_payload(slug: str = "browse-route", tags: Optional[List[str]] = None) -> dict:
    """Payload for a public route with geometry inside a small bbox (~20 km²)."""
    if tags is None:
        tags = ["urban"]
    return {
        "title": "Browse Test Route",
        "description": "For discovery tests",
        "route_geometry": {
            "type": "LineString",
            "coordinates": [[-122.4, 37.8], [-122.38, 37.82]],
        },
        "slug": slug,
        "tags": tags,
        "is_public": True,
    }


@requires_postgres
def test_get_v1_routes_browse_returns_routes_and_pagination() -> None:
    """GET /v1/routes returns {routes, pagination}. No auth required."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    slug = f"browse-route-{uuid4().hex[:8]}"
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_public_route_payload(slug=slug),
            )
            assert resp.status_code in (200, 201)
            response = client.get(f"/v1/routes?author_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert "routes" in data
        assert "pagination" in data
        pagination = data["pagination"]
        assert "page" in pagination
        assert "per_page" in pagination
        assert "total" in pagination
        assert pagination["page"] == 1
        assert pagination["per_page"] == 20
        assert pagination["total"] >= 1
        routes = data["routes"]
        assert len(routes) >= 1
        route = next((r for r in routes if r.get("slug") == slug), None)
        assert route is not None
        assert route["is_public"] is True
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_routes_with_bbox_returns_routes_in_area() -> None:
    """GET /v1/routes?bbox=... returns public routes whose geometry intersects the bbox."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    slug = f"inside-bbox-{uuid4().hex[:8]}"
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_public_route_payload(slug=slug),
            )
            assert resp.status_code in (200, 201)
            # Bbox ~20 km² that contains the route at (-122.4,37.8)-(-122.38,37.82)
            response = client.get(
                f"/v1/routes?bbox=-122.42,37.78,-122.38,37.84&author_id={user.id}"
            )
        assert response.status_code == 200
        data = response.json()
        routes = data["routes"]
        assert data["pagination"]["total"] >= 1
        slugs = [r["slug"] for r in routes]
        assert slug in slugs
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_routes_with_tags_returns_routes_with_tag() -> None:
    """GET /v1/routes?tags=urban returns routes that have the tag (UAT-FR5.2)."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    slug = f"urban-route-{uuid4().hex[:8]}"
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_public_route_payload(slug=slug, tags=["urban"]),
            )
            assert resp.status_code in (200, 201)
            response = client.get(f"/v1/routes?tags=urban&author_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        routes = data["routes"]
        assert data["pagination"]["total"] >= 1
        urban_routes = [r for r in routes if "urban" in (r.get("tags") or [])]
        assert len(urban_routes) >= 1
        assert any(r["slug"] == slug for r in urban_routes)
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_routes_bbox_too_large_returns_400() -> None:
    """GET /v1/routes?bbox=... with area > 200 km² returns 400."""
    settings = _minimal_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.get("/v1/routes?bbox=-122.5,37.0,-121.5,38.0")
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_settings, None)
