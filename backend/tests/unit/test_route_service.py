"""Unit tests for app.services.route_service."""
from __future__ import annotations

from typing import Optional
from uuid import uuid4

import pytest
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.models.photo import Photo
from app.models.route_photo import RoutePhoto
from app.models.user import User
from app.schemas.route import RouteCreate, RouteFromPhotosCreate, RouteGeometrySchema, RouteUpdate
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


def _photo_with_location(
    user_id,
    lon: float = -122.4,
    lat: float = 37.8,
    s3_key: str = "user/photo.jpg",
) -> Photo:
    """Create a Photo model instance with location (caller must add to session and flush)."""
    return Photo(
        user_id=user_id,
        s3_key_original=s3_key,
        s3_key_thumbnail=None,
        location=WKTElement(f"POINT({lon} {lat})", srid=4326),
        caption=None,
        exif_data=None,
        file_size_bytes=1000,
        captured_at=None,
    )


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_from_photos_builds_linestring_from_photo_order(
    db_session: AsyncSession,
) -> None:
    """create_route_from_photos builds LineString from photo locations in photo_ids order."""
    user = User(google_id="g11", email="u11@example.com", name="User Eleven")
    db_session.add(user)
    await db_session.flush()
    p1 = _photo_with_location(user.id, -122.4, 37.8, "user/p1.jpg")
    p2 = _photo_with_location(user.id, -122.41, 37.81, "user/p2.jpg")
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()
    data = RouteFromPhotosCreate(
        title="From Photos",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    route = await route_service.create_route_from_photos(db_session, user.id, data)
    assert route.title == "From Photos"
    assert route.distance_meters > 0
    assert len(route.route_photos) == 2
    assert route.route_photos[0].photo_id == p1.id
    assert route.route_photos[0].display_order == 0
    assert route.route_photos[1].photo_id == p2.id
    assert route.route_photos[1].display_order == 1
    geom = mapping(to_shape(route.route_geometry))
    assert geom["type"] == "LineString"
    # Shapely mapping() returns coordinates as tuples
    assert list(geom["coordinates"][0]) == [-122.4, 37.8]
    assert list(geom["coordinates"][1]) == [-122.41, 37.81]


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_from_photos_rejects_when_photo_has_null_location(
    db_session: AsyncSession,
) -> None:
    """create_route_from_photos rejects when any photo has null location."""
    user = User(google_id="g12", email="u12@example.com", name="User Twelve")
    db_session.add(user)
    await db_session.flush()
    p1 = _photo_with_location(user.id, -122.4, 37.8, "user/p1.jpg")
    p2 = Photo(
        user_id=user.id,
        s3_key_original="user/p2.jpg",
        s3_key_thumbnail=None,
        location=None,
        caption=None,
        exif_data=None,
        file_size_bytes=1000,
        captured_at=None,
    )
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()
    data = RouteFromPhotosCreate(
        title="From Photos",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    with pytest.raises(ValueError, match="has no location"):
        await route_service.create_route_from_photos(db_session, user.id, data)


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_from_photos_rejects_when_fewer_than_two_photos(
    db_session: AsyncSession,
) -> None:
    """create_route_from_photos rejects when photo_ids has fewer than 2 items."""
    user = User(google_id="g13", email="u13@example.com", name="User Thirteen")
    db_session.add(user)
    await db_session.flush()
    p1 = _photo_with_location(user.id, -122.4, 37.8, "user/p1.jpg")
    db_session.add(p1)
    await db_session.flush()
    # Use model_construct to bypass Pydantic min_length=2 so we test service validation
    data = RouteFromPhotosCreate.model_construct(
        title="From Photos",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id],
        slug=None,
    )
    with pytest.raises(ValueError, match="At least 2 photos"):
        await route_service.create_route_from_photos(db_session, user.id, data)


@requires_postgres
@pytest.mark.asyncio
async def test_create_route_from_photos_rejects_when_user_does_not_own_photo(
    db_session: AsyncSession,
) -> None:
    """create_route_from_photos rejects when user does not own one of the photos."""
    owner = User(google_id="g14", email="u14@example.com", name="Owner")
    other = User(google_id="g15", email="u15@example.com", name="Other")
    db_session.add(owner)
    db_session.add(other)
    await db_session.flush()
    p1 = _photo_with_location(owner.id, -122.4, 37.8, "owner/p1.jpg")
    p2 = _photo_with_location(owner.id, -122.41, 37.81, "owner/p2.jpg")
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()
    data = RouteFromPhotosCreate(
        title="From Photos",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    with pytest.raises(ValueError, match="not owned"):
        await route_service.create_route_from_photos(db_session, other.id, data)


@requires_postgres
@pytest.mark.asyncio
async def test_recompute_route_geometry_from_photos_updates_geometry_from_photo_order(
    db_session: AsyncSession,
) -> None:
    """recompute_route_geometry_from_photos rebuilds geometry from route_photos display_order."""
    user = User(google_id="g20", email="u20@example.com", name="User Twenty")
    db_session.add(user)
    await db_session.flush()
    p1 = _photo_with_location(user.id, -122.4, 37.8, "user/p1.jpg")
    p2 = _photo_with_location(user.id, -122.41, 37.81, "user/p2.jpg")
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()
    data = RouteFromPhotosCreate(
        title="Recompute Test",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    route = await route_service.create_route_from_photos(db_session, user.id, data)
    # Swap display_order so p2 comes first
    rp0, rp1 = route.route_photos[0], route.route_photos[1]
    rp0.display_order, rp1.display_order = 1, 0
    await db_session.flush()
    updated = await route_service.recompute_route_geometry_from_photos(db_session, route.id)
    assert updated is not None
    geom = mapping(to_shape(updated.route_geometry))
    assert geom["type"] == "LineString"
    assert list(geom["coordinates"][0]) == [-122.41, 37.81]
    assert list(geom["coordinates"][1]) == [-122.4, 37.8]
    assert updated.distance_meters > 0


@requires_postgres
@pytest.mark.asyncio
async def test_recompute_route_geometry_from_photos_with_one_photo_handles_gracefully(
    db_session: AsyncSession,
) -> None:
    """recompute with 1 photo with location sets degenerate LineString, distance 0."""
    user = User(google_id="g21", email="u21@example.com", name="User Twenty-One")
    db_session.add(user)
    await db_session.flush()
    p1 = _photo_with_location(user.id, -122.4, 37.8, "user/p1.jpg")
    p2 = _photo_with_location(user.id, -122.41, 37.81, "user/p2.jpg")
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()
    data = RouteFromPhotosCreate(
        title="One Photo Left",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    route = await route_service.create_route_from_photos(db_session, user.id, data)
    # Remove one route_photo so only one remains
    await db_session.delete(route.route_photos[1])
    await db_session.flush()
    updated = await route_service.recompute_route_geometry_from_photos(db_session, route.id)
    assert updated is not None
    assert updated.distance_meters == 0.0
    geom = mapping(to_shape(updated.route_geometry))
    assert geom["type"] == "LineString"
    assert len(geom["coordinates"]) == 2
    assert list(geom["coordinates"][0]) == list(geom["coordinates"][1]) == [-122.4, 37.8]


@requires_postgres
@pytest.mark.asyncio
async def test_recompute_route_geometry_from_photos_returns_none_for_invalid_route_id(
    db_session: AsyncSession,
) -> None:
    """recompute_route_geometry_from_photos returns None when route does not exist."""
    result = await route_service.recompute_route_geometry_from_photos(db_session, uuid4())
    assert result is None


@requires_postgres
@pytest.mark.asyncio
async def test_reorder_route_photos_updates_display_order(db_session: AsyncSession) -> None:
    """reorder_route_photos sets display_order to match supplied photo_ids list."""
    user = User(google_id="g_reorder", email="reorder@example.com", name="Reorder User")
    db_session.add(user)
    await db_session.flush()

    p1 = _photo_with_location(user.id, -122.4, 37.8, "reorder/p1.jpg")
    p2 = _photo_with_location(user.id, -122.41, 37.81, "reorder/p2.jpg")
    db_session.add_all([p1, p2])
    await db_session.flush()

    data = RouteFromPhotosCreate(
        title="Reorder Route",
        description=None,
        tags=[],
        is_public=False,
        photo_ids=[p1.id, p2.id],
        slug=None,
    )
    route = await route_service.create_route_from_photos(db_session, user.id, data)

    # Reorder to p2 first, p1 second
    await route_service.reorder_route_photos(db_session, route.id, user.id, [p2.id, p1.id])

    rps = (await db_session.execute(
        select(RoutePhoto)
        .where(RoutePhoto.route_id == route.id)
        .order_by(RoutePhoto.display_order)
    )).scalars().all()
    assert rps[0].photo_id == p2.id
    assert rps[1].photo_id == p1.id


@requires_postgres
@pytest.mark.asyncio
async def test_reorder_route_photos_raises_if_not_owner(db_session: AsyncSession) -> None:
    """reorder_route_photos raises RouteForbiddenError when caller is not owner."""
    user = User(google_id="g_reorder_own", email="reorder_own@example.com", name="Owner")
    other = User(google_id="g_reorder_oth", email="reorder_oth@example.com", name="Other")
    db_session.add_all([user, other])
    await db_session.flush()

    data = RouteCreate(
        title="Another Route",
        description=None,
        route_geometry=RouteGeometrySchema(
            type="LineString",
            coordinates=[[-122.4, 37.8], [-122.41, 37.81]],
        ),
        slug=None,
        tags=[],
        is_public=False,
    )
    route = await route_service.create_route(db_session, user.id, data)

    with pytest.raises(RouteForbiddenError):
        await route_service.reorder_route_photos(db_session, route.id, other.id, [])


@requires_postgres
@pytest.mark.asyncio
async def test_reorder_route_photos_raises_not_found_for_invalid_route_id(db_session: AsyncSession) -> None:
    """reorder_route_photos raises RouteNotFoundError when route does not exist."""
    user = User(google_id="g_reorder_nf", email="reorder_nf@example.com", name="Not Found User")
    db_session.add(user)
    await db_session.flush()
    with pytest.raises(RouteNotFoundError):
        await route_service.reorder_route_photos(db_session, uuid4(), user.id, [])
