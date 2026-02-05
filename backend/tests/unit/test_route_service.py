"""Unit tests for app.services.route_service."""
from __future__ import annotations

from typing import Optional
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.models.route import Route
from app.models.user import User
from app.schemas.route import RouteCreate, RouteGeometrySchema, RouteUpdate
from app.services import route_service
from tests.conftest import requires_postgres


def _valid_route_create(
    title: str = "Test Route",
    slug: Optional[str] = None,
    coordinates: Optional[list[list[float]]] = None,
) -> RouteCreate:
    if coordinates is None:
        coordinates = [[-122.4, 37.8], [-122.41, 37.81]]
    return RouteCreate(
        title=title,
        description=None,
        route_geometry=RouteGeometrySchema(type="LineString", coordinates=coordinates),
        slug=slug,
        tags=[],
        is_public=False,
    )


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_validates_geometry_reject_too_few_points(db_session: AsyncSession) -> None:
    """create_route rejects geometry with fewer than 2 points (via distance > 0)."""
    user = User(google_id="g1", email="u1@example.com", name="User One")
    db_session.add(user)
    await db_session.flush()
    data = _valid_route_create(coordinates=[[-122.4, 37.8], [-122.4, 37.8]])
    with pytest.raises(ValueError, match="greater than 0"):
        await route_service.create_route(db_session, user.id, data)


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_generates_unique_slug(db_session: AsyncSession) -> None:
    """create_route produces a slug in title-shortid format."""
    user = User(google_id="g2", email="u2@example.com", name="User Two")
    db_session.add(user)
    await db_session.flush()
    data = _valid_route_create()
    route = await route_service.create_route(db_session, user.id, data)
    assert route.slug is not None
    assert "-" in route.slug
    assert route.title == "Test Route"


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_with_override_slug_uses_it_if_unique(db_session: AsyncSession) -> None:
    """create_route with slug override uses it when unique."""
    user = User(google_id="g3", email="u3@example.com", name="User Three")
    db_session.add(user)
    await db_session.flush()
    data = _valid_route_create(slug="my-custom-slug")
    route = await route_service.create_route(db_session, user.id, data)
    assert route.slug == "my-custom-slug"


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_with_duplicate_override_slug_appends_suffix(db_session: AsyncSession) -> None:
    """create_route with duplicate override slug appends numeric suffix."""
    user = User(google_id="g4", email="u4@example.com", name="User Four")
    db_session.add(user)
    await db_session.flush()
    data1 = _valid_route_create(slug="dup-slug")
    route1 = await route_service.create_route(db_session, user.id, data1)
    assert route1.slug == "dup-slug"

    data2 = _valid_route_create(title="Other", slug="dup-slug")
    route2 = await route_service.create_route(db_session, user.id, data2)
    assert route2.slug == "dup-slug-1"


@requires_postgres
@pytest.mark.asyncio
async def test_get_route_by_slug_returns_none_for_invalid_slug(db_session: AsyncSession) -> None:
    """get_route_by_slug returns None when slug does not exist."""
    result = await route_service.get_route_by_slug(db_session, "nonexistent-slug-xyz")
    assert result is None


@requires_postgres
@pytest.mark.asyncio
async def test_update_route_returns_403_when_user_not_owner(db_session: AsyncSession) -> None:
    """update_route raises RouteForbiddenError when user is not owner."""
    owner = User(google_id="g5", email="u5@example.com", name="Owner")
    other = User(google_id="g6", email="u6@example.com", name="Other")
    db_session.add(owner)
    db_session.add(other)
    await db_session.flush()
    data = _valid_route_create(slug="owner-route")
    route = await route_service.create_route(db_session, owner.id, data)
    update_data = RouteUpdate(title="Hacked")
    with pytest.raises(RouteForbiddenError):
        await route_service.update_route(db_session, route.id, other.id, update_data)


@requires_postgres
@pytest.mark.asyncio
async def test_delete_route_returns_403_when_user_not_owner(db_session: AsyncSession) -> None:
    """delete_route raises RouteForbiddenError when user is not owner."""
    owner = User(google_id="g7", email="u7@example.com", name="Owner")
    other = User(google_id="g8", email="u8@example.com", name="Other")
    db_session.add(owner)
    db_session.add(other)
    await db_session.flush()
    data = _valid_route_create(slug="owner-route-del")
    route = await route_service.create_route(db_session, owner.id, data)
    with pytest.raises(RouteForbiddenError):
        await route_service.delete_route(db_session, route.id, other.id)


@requires_postgres
@pytest.mark.asyncio
async def test_update_route_raises_not_found_for_invalid_id(db_session: AsyncSession) -> None:
    """update_route raises RouteNotFoundError when route does not exist."""
    user = User(google_id="g9", email="u9@example.com", name="User")
    db_session.add(user)
    await db_session.flush()
    with pytest.raises(RouteNotFoundError):
        await route_service.update_route(db_session, uuid4(), user.id, RouteUpdate(title="X"))


@requires_postgres
@pytest.mark.asyncio
async def test_delete_route_raises_not_found_for_invalid_id(db_session: AsyncSession) -> None:
    """delete_route raises RouteNotFoundError when route does not exist."""
    user = User(google_id="g10", email="u10@example.com", name="User")
    db_session.add(user)
    await db_session.flush()
    with pytest.raises(RouteNotFoundError):
        await route_service.delete_route(db_session, uuid4(), user.id)
