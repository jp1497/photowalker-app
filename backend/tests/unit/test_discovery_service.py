"""Unit tests for app.services.discovery_service."""
from __future__ import annotations

from typing import Optional

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BboxTooLargeError
from app.models.user import User
from app.schemas.route import RouteCreate, RouteGeometrySchema
from app.services import discovery_service, route_service
from tests.conftest import requires_postgres


def _route_create(
    title: str = "Test Route",
    slug: Optional[str] = None,
    coordinates: Optional[list[list[float]]] = None,
    is_public: bool = True,
    tags: Optional[list[str]] = None,
) -> RouteCreate:
    if coordinates is None:
        coordinates = [[-122.4, 37.8], [-122.41, 37.81]]
    return RouteCreate(
        title=title,
        description=None,
        route_geometry=RouteGeometrySchema(type="LineString", coordinates=coordinates),
        slug=slug,
        tags=tags or [],
        is_public=is_public,
    )


@requires_postgres
@pytest.mark.asyncio
async def test_browse_routes_returns_only_public_routes(db_session: AsyncSession) -> None:
    """browse_routes returns only public routes; private routes are excluded."""
    user = User(google_id="d1", email="d1@example.com", name="Discover One")
    db_session.add(user)
    await db_session.flush()

    public_data = _route_create(slug="public-route", is_public=True)
    private_data = _route_create(slug="private-route", is_public=False, title="Private")
    await route_service.create_route(db_session, user.id, public_data)
    await route_service.create_route(db_session, user.id, private_data)
    await db_session.flush()

    routes, total, page, per_page = await discovery_service.browse_routes(db_session)
    assert total == 1
    assert len(routes) == 1
    assert routes[0].slug == "public-route"
    assert routes[0].is_public is True


@requires_postgres
@pytest.mark.asyncio
async def test_browse_routes_bbox_filter_returns_routes_within_bounds(db_session: AsyncSession) -> None:
    """bbox filter returns only routes whose geometry intersects the bounding box."""
    user = User(google_id="d2", email="d2@example.com", name="Discover Two")
    db_session.add(user)
    await db_session.flush()

    # Route inside small bbox (< 50 km²): ~0.04 deg x 0.06 deg
    inside = _route_create(
        slug="inside-route",
        coordinates=[[-122.4, 37.8], [-122.38, 37.82]],
    )
    # Route outside (e.g. far north)
    outside = _route_create(
        slug="outside-route",
        coordinates=[[-122.4, 38.5], [-122.39, 38.51]],
    )
    await route_service.create_route(db_session, user.id, inside)
    await route_service.create_route(db_session, user.id, outside)
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)  # ~20 km², under 50 km² limit
    routes, total, _, _ = await discovery_service.browse_routes(db_session, bbox=bbox)
    assert total == 1
    assert len(routes) == 1
    assert routes[0].slug == "inside-route"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_routes_tags_filter_and_logic(db_session: AsyncSession) -> None:
    """tags filter applies AND logic: route must have all specified tags."""
    user = User(google_id="d3", email="d3@example.com", name="Discover Three")
    db_session.add(user)
    await db_session.flush()

    # Route with urban only
    r1 = _route_create(slug="urban-only", tags=["urban"])
    # Route with urban and night
    r2 = _route_create(slug="urban-night", tags=["urban", "night"])
    # Route with night only
    r3 = _route_create(slug="night-only", tags=["night"])
    await route_service.create_route(db_session, user.id, r1)
    await route_service.create_route(db_session, user.id, r2)
    await route_service.create_route(db_session, user.id, r3)
    await db_session.flush()

    routes, total, _, _ = await discovery_service.browse_routes(db_session, tags=["urban", "night"])
    assert total == 1
    assert len(routes) == 1
    assert routes[0].slug == "urban-night"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_routes_pagination(db_session: AsyncSession) -> None:
    """pagination returns correct page and total."""
    user = User(google_id="d4", email="d4@example.com", name="Discover Four")
    db_session.add(user)
    await db_session.flush()

    for i in range(4):
        await route_service.create_route(
            db_session,
            user.id,
            _route_create(slug=f"page-route-{i}"),
        )
    await db_session.flush()

    routes, total, page, per_page = await discovery_service.browse_routes(
        db_session, page=1, per_page=2
    )
    assert total == 4
    assert page == 1
    assert per_page == 2
    assert len(routes) == 2

    routes_p2, total_p2, page_p2, _ = await discovery_service.browse_routes(
        db_session, page=2, per_page=2
    )
    assert total_p2 == 4
    assert page_p2 == 2
    assert len(routes_p2) == 2


@requires_postgres
@pytest.mark.asyncio
async def test_browse_routes_bbox_too_large_raises_error(db_session: AsyncSession) -> None:
    """bbox larger than 50 km² raises BboxTooLargeError."""
    # ~1 degree x 1 degree at mid-lat is ~10k+ km², well over 50 km²
    huge_bbox = (-122.5, 37.0, -121.5, 38.0)
    with pytest.raises(BboxTooLargeError):
        await discovery_service.browse_routes(db_session, bbox=huge_bbox)
