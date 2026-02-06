"""Unit tests for app.services.photo_service."""
from __future__ import annotations

import tempfile
from uuid import uuid4

import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import PhotoForbiddenError, PhotoNotFoundError
from app.models import Photo, Route, RoutePhoto, User
from app.services import photo_service
from tests.conftest import requires_postgres

# Minimal JPEG (no EXIF GPS)
MINIMAL_JPEG = b"\xff\xd8\xff\xd9"


def _local_storage_settings() -> Settings:
    """Settings with local storage for tests (no S3)."""
    return Settings(
        database_url="postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="your-access-key",
        aws_secret_access_key="your-secret-key",
        s3_bucket_name="test",
        local_storage_path=tempfile.mkdtemp(),
    )


@requires_postgres
@pytest.mark.asyncio
async def test_upload_photo_rejects_non_jpeg(db_session: AsyncSession) -> None:
    """upload_photo raises ValueError for non-JPEG content."""
    user = User(google_id="g0", email="u0@example.com", name="User Zero")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="r0",
        title="R0",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=100.0,
        is_public=False,
    )
    db_session.add(route)
    await db_session.flush()
    settings = _local_storage_settings()
    with pytest.raises(ValueError, match="JPEG"):
        await photo_service.upload_photo(
            db_session, settings, user.id, b"not a jpeg", "image/png", None, [route.id]
        )


@requires_postgres
@pytest.mark.asyncio
async def test_upload_photo_with_no_gps_creates_photo_with_null_location(
    db_session: AsyncSession,
) -> None:
    """upload_photo with no EXIF GPS creates photo with location=NULL (PRD v3 FR-R3)."""
    user = User(google_id="g1", email="u1@example.com", name="User One")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="r1",
        title="R1",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=100.0,
        is_public=False,
    )
    db_session.add(route)
    await db_session.flush()
    settings = _local_storage_settings()
    photo = await photo_service.upload_photo(
        db_session, settings, user.id, MINIMAL_JPEG, "image/jpeg", None, [route.id]
    )
    assert photo.location is None
    assert photo.user_id == user.id


@requires_postgres
@pytest.mark.asyncio
async def test_upload_photo_creates_photo_and_route_photos(db_session: AsyncSession) -> None:
    """upload_photo creates photo and route_photos when EXIF has GPS."""
    from unittest.mock import patch

    user = User(google_id="g2", email="u2@example.com", name="User Two")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="r2",
        title="R2",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=100.0,
        is_public=False,
    )
    db_session.add(route)
    await db_session.flush()
    settings = _local_storage_settings()
    with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
        with patch("app.services.photo_service.extract_captured_at", return_value=None):
            photo = await photo_service.upload_photo(
                db_session,
                settings,
                user.id,
                MINIMAL_JPEG,
                "image/jpeg",
                "Cap",
                [route.id],
            )
    assert photo.id is not None
    assert photo.user_id == user.id
    assert photo.caption == "Cap"
    assert "original.jpg" in photo.s3_key_original
    assert photo.file_size_bytes == len(MINIMAL_JPEG)
    r = await db_session.execute(
        select(RoutePhoto).where(RoutePhoto.photo_id == photo.id)
    )
    route_photos = r.scalars().all()
    assert len(route_photos) == 1
    assert route_photos[0].route_id == route.id
    assert route_photos[0].display_order == 0


@requires_postgres
@pytest.mark.asyncio
async def test_upload_photo_with_route_ids_empty_creates_photo_without_route_photos(
    db_session: AsyncSession,
) -> None:
    """upload_photo with route_ids=[] creates photo without route_photos (for new route creation)."""
    from unittest.mock import patch

    user = User(google_id="g2b", email="u2b@example.com", name="User Two B")
    db_session.add(user)
    await db_session.flush()
    settings = _local_storage_settings()
    with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
        with patch("app.services.photo_service.extract_captured_at", return_value=None):
            photo = await photo_service.upload_photo(
                db_session, settings, user.id, MINIMAL_JPEG, "image/jpeg", None, []
            )
    assert photo.id is not None
    r = await db_session.execute(
        select(RoutePhoto).where(RoutePhoto.photo_id == photo.id)
    )
    assert len(r.scalars().all()) == 0


@requires_postgres
@pytest.mark.asyncio
async def test_get_photos_by_route_returns_photos_in_display_order(db_session: AsyncSession) -> None:
    """get_photos_by_route returns photos ordered by display_order."""
    user = User(google_id="g3", email="u3@example.com", name="User Three")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="r3",
        title="R3",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.41 37.81)", srid=4326),
        distance_meters=100.0,
        is_public=False,
    )
    db_session.add(route)
    await db_session.flush()
    p1 = Photo(
        user_id=user.id,
        s3_key_original="photos/u/p1/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    p2 = Photo(
        user_id=user.id,
        s3_key_original="photos/u/p2/original.jpg",
        location=WKTElement("POINT(-122.41 37.81)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add_all([p1, p2])
    await db_session.flush()
    db_session.add(RoutePhoto(route_id=route.id, photo_id=p2.id, display_order=1))
    db_session.add(RoutePhoto(route_id=route.id, photo_id=p1.id, display_order=0))
    await db_session.flush()

    photos = await photo_service.get_photos_by_route(db_session, route.id, "display_order")
    assert len(photos) == 2
    assert photos[0].id == p1.id
    assert photos[1].id == p2.id


@requires_postgres
@pytest.mark.asyncio
async def test_update_photo_enforces_ownership(db_session: AsyncSession) -> None:
    """update_photo raises PhotoForbiddenError when not owner."""
    owner = User(google_id="g4", email="o@example.com", name="Owner")
    other = User(google_id="g5", email="x@example.com", name="Other")
    db_session.add_all([owner, other])
    await db_session.flush()
    photo = Photo(
        user_id=owner.id,
        s3_key_original="photos/o/p/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()

    with pytest.raises(PhotoForbiddenError):
        await photo_service.update_photo(db_session, photo.id, other.id, "New cap", None)


@requires_postgres
@pytest.mark.asyncio
async def test_delete_photo_enforces_ownership(db_session: AsyncSession) -> None:
    """delete_photo raises PhotoForbiddenError when not owner."""
    owner = User(google_id="g6", email="o2@example.com", name="Owner")
    other = User(google_id="g7", email="x2@example.com", name="Other")
    db_session.add_all([owner, other])
    await db_session.flush()
    photo = Photo(
        user_id=owner.id,
        s3_key_original="photos/o/p2/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()
    settings = _local_storage_settings()

    with pytest.raises(PhotoForbiddenError):
        await photo_service.delete_photo(db_session, settings, photo.id, other.id)


@requires_postgres
@pytest.mark.asyncio
async def test_update_photo_not_found_raises(db_session: AsyncSession) -> None:
    """update_photo raises PhotoNotFoundError for missing photo."""
    user = User(google_id="g8", email="u8@example.com", name="User")
    db_session.add(user)
    await db_session.flush()

    with pytest.raises(PhotoNotFoundError):
        await photo_service.update_photo(db_session, uuid4(), user.id, "Cap", None)


@requires_postgres
@pytest.mark.asyncio
async def test_update_photo_with_location_updates_photo_location(
    db_session: AsyncSession,
) -> None:
    """update_photo with location updates photo.location (PRD v3 FR-R3)."""
    user = User(google_id="g10", email="u10@example.com", name="User Ten")
    db_session.add(user)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/p10/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()

    updated = await photo_service.update_photo(
        db_session,
        photo.id,
        user.id,
        None,
        None,
        location={"type": "Point", "coordinates": [-122.5, 37.9]},
    )
    assert updated.location is not None
    from geoalchemy2.shape import to_shape
    point = to_shape(updated.location)
    assert point.x == pytest.approx(-122.5)
    assert point.y == pytest.approx(37.9)


@requires_postgres
@pytest.mark.asyncio
async def test_update_photo_with_invalid_coordinates_raises(
    db_session: AsyncSession,
) -> None:
    """update_photo with invalid coordinates raises ValueError."""
    user = User(google_id="g11", email="u11@example.com", name="User Eleven")
    db_session.add(user)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/p11/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()

    with pytest.raises(ValueError, match="longitude"):
        await photo_service.update_photo(
            db_session,
            photo.id,
            user.id,
            None,
            None,
            location={"type": "Point", "coordinates": [200, 37.9]},
        )
    with pytest.raises(ValueError, match="latitude"):
        await photo_service.update_photo(
            db_session,
            photo.id,
            user.id,
            None,
            None,
            location={"type": "Point", "coordinates": [-122.5, 100]},
        )


@requires_postgres
@pytest.mark.asyncio
async def test_delete_photo_not_found_raises(db_session: AsyncSession) -> None:
    """delete_photo raises PhotoNotFoundError for missing photo."""
    user = User(google_id="g9", email="u9@example.com", name="User")
    db_session.add(user)
    await db_session.flush()
    settings = _local_storage_settings()

    with pytest.raises(PhotoNotFoundError):
        await photo_service.delete_photo(db_session, settings, uuid4(), user.id)
