
import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Photo, Route, RoutePhoto, RouteTag, Tag, User
from tests.conftest import requires_postgres


def test_models_import_without_error() -> None:
    """All models import without error."""
    assert User is not None
    assert Route is not None
    assert Photo is not None
    assert Tag is not None
    assert RoutePhoto is not None
    assert RouteTag is not None


def test_user_has_routes_relationship() -> None:
    """User model has routes relationship."""
    assert hasattr(User, "routes")
    assert User.routes.property.back_populates == "user"


def test_user_has_photos_relationship() -> None:
    """User model has photos relationship."""
    assert hasattr(User, "photos")
    assert User.photos.property.back_populates == "user"


def test_route_has_user_relationship() -> None:
    """Route model has user relationship."""
    assert hasattr(Route, "user")
    assert Route.user.property.back_populates == "routes"


def test_route_has_route_photos_relationship() -> None:
    """Route model has route_photos relationship to junction table."""
    assert hasattr(Route, "route_photos")
    assert Route.route_photos.property.back_populates == "route"


def test_route_has_route_tags_relationship() -> None:
    """Route model has route_tags relationship."""
    assert hasattr(Route, "route_tags")


def test_photo_has_route_photos_relationship() -> None:
    """Photo model has route_photos relationship (many-to-many with routes)."""
    assert hasattr(Photo, "route_photos")
    assert Photo.route_photos.property.back_populates == "photo"


@requires_postgres
@pytest.mark.asyncio
async def test_model_creation_and_relationships(db_session) -> None:
    """Create user, route, photo and verify relationships persist."""
    user = User(
        google_id="google-123",
        email="test@example.com",
        name="Test User",
    )
    db_session.add(user)
    await db_session.flush()

    route = Route(
        user_id=user.id,
        slug="test-route-abc",
        title="Test Route",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=100.5,
        is_public=False,
    )
    db_session.add(route)
    await db_session.flush()

    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/user1/photo1/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=1024000,
    )
    db_session.add(photo)
    await db_session.flush()

    route_photo = RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=0)
    db_session.add(route_photo)
    await db_session.flush()

    result = await db_session.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.routes), selectinload(User.photos))
    )
    loaded_user = result.scalar_one()
    assert loaded_user.email == "test@example.com"
    assert len(loaded_user.routes) == 1
    assert loaded_user.routes[0].title == "Test Route"
    assert len(loaded_user.photos) == 1

    result = await db_session.execute(
        select(Route)
        .where(Route.id == route.id)
        .options(selectinload(Route.route_photos).selectinload(RoutePhoto.photo))
    )
    loaded_route = result.scalar_one()
    assert len(loaded_route.route_photos) == 1
    assert loaded_route.route_photos[0].photo.s3_key_original == "photos/user1/photo1/original.jpg"


@requires_postgres
@pytest.mark.asyncio
async def test_geometry_columns_accept_wkt(db_session) -> None:
    """Geometry columns accept WKT/EWKT via WKTElement."""
    user = User(google_id="geo-test", email="geo@test.com", name="Geo User")
    db_session.add(user)
    await db_session.flush()

    # LineString for route
    route = Route(
        user_id=user.id,
        slug="geom-test-route",
        title="Geometry Test",
        route_geometry=WKTElement("SRID=4326;LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=150.0,
        is_public=True,
    )
    db_session.add(route)
    await db_session.flush()

    # Point for photo
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/geo/1/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=50000,
    )
    db_session.add(photo)
    await db_session.flush()

    result = await db_session.execute(select(Route).where(Route.slug == "geom-test-route"))
    loaded_route = result.scalar_one()
    assert loaded_route.route_geometry is not None

    result = await db_session.execute(select(Photo).where(Photo.id == photo.id))
    loaded_photo = result.scalar_one()
    assert loaded_photo.location is not None
