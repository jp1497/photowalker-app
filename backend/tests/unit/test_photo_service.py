"""Unit tests for app.services.photo_service."""
from __future__ import annotations

import tempfile
from uuid import uuid4

import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import BboxTooLargeError, PhotoForbiddenError, PhotoNotFoundError
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


# --- browse_photos (PRD v6 - Step 0.1) ---


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_returns_photos_in_bbox_on_public_route(db_session: AsyncSession) -> None:
    """browse_photos returns photos with location inside bbox that are on a public non-draft route."""
    user = User(google_id="browse1", email="browse1@example.com", name="Browse User")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="browse-route-public",
        title="Public",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.38 37.82)", srid=4326),
        distance_meters=100.0,
        is_public=True,
        is_draft=False,
    )
    db_session.add(route)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/bp1/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()
    db_session.add(RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=0))
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos, total, page, per_page = await photo_service.browse_photos(db_session, bbox=bbox)
    assert total >= 1
    our = next((p for p in photos if p.id == photo.id), None)
    assert our is not None, "our photo (public route, in bbox) should appear in browse_photos"
    assert our.user.name == "Browse User"
    assert len(our.route_photos) == 1
    assert our.route_photos[0].route.slug == "browse-route-public"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_excludes_photos_outside_bbox(db_session: AsyncSession) -> None:
    """browse_photos does not return photos whose location is outside the bbox."""
    user = User(google_id="browse2", email="browse2@example.com", name="Browse Two")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="browse-route-out",
        title="Out",
        route_geometry=WKTElement("LINESTRING(-122.4 38.5, -122.39 38.51)", srid=4326),
        distance_meters=100.0,
        is_public=True,
        is_draft=False,
    )
    db_session.add(route)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/bp2/original.jpg",
        location=WKTElement("POINT(-122.4 38.5)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()
    db_session.add(RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=0))
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos, total, _, _ = await photo_service.browse_photos(db_session, bbox=bbox)
    our = next((p for p in photos if p.id == photo.id), None)
    assert our is None, "photo outside bbox (lat 38.5) must not appear when bbox is 37.78-37.84"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_excludes_photos_only_on_draft_route(db_session: AsyncSession) -> None:
    """browse_photos does not return photos that appear only on draft routes."""
    user = User(google_id="browse3a", email="browse3a@example.com", name="Browse Three A")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="browse-route-draft",
        title="Draft",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.38 37.82)", srid=4326),
        distance_meters=100.0,
        is_public=True,
        is_draft=True,
    )
    db_session.add(route)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/bp3a/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()
    db_session.add(RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=0))
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos, total, _, _ = await photo_service.browse_photos(db_session, bbox=bbox)
    our = next((p for p in photos if p.id == photo.id), None)
    assert our is None, "photo only on draft route must not appear in browse_photos"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_excludes_photos_only_on_private_route(db_session: AsyncSession) -> None:
    """browse_photos returns only photos that appear on at least one public route."""
    user = User(google_id="browse3", email="browse3@example.com", name="Browse Three")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="browse-route-private",
        title="Private",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.38 37.82)", srid=4326),
        distance_meters=100.0,
        is_public=False,
        is_draft=False,
    )
    db_session.add(route)
    await db_session.flush()
    photo = Photo(
        user_id=user.id,
        s3_key_original="photos/u/bp3/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add(photo)
    await db_session.flush()
    db_session.add(RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=0))
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos, total, _, _ = await photo_service.browse_photos(db_session, bbox=bbox)
    our = next((p for p in photos if p.id == photo.id), None)
    assert our is None, "photo only on private route must not appear in browse_photos"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_bbox_too_large_raises(db_session: AsyncSession) -> None:
    """browse_photos raises BboxTooLargeError when bbox area exceeds 200 km²."""
    huge_bbox = (-122.5, 37.0, -121.5, 38.0)
    with pytest.raises(BboxTooLargeError):
        await photo_service.browse_photos(db_session, bbox=huge_bbox)


@requires_postgres
@pytest.mark.asyncio
async def test_browse_photos_pagination(db_session: AsyncSession) -> None:
    """browse_photos respects page and per_page; returns correct total."""
    user = User(google_id="browse4", email="browse4@example.com", name="Browse Four")
    db_session.add(user)
    await db_session.flush()
    route = Route(
        user_id=user.id,
        slug="browse-route-pag",
        title="Pag",
        route_geometry=WKTElement("LINESTRING(-122.4 37.8, -122.38 37.82)", srid=4326),
        distance_meters=100.0,
        is_public=True,
        is_draft=False,
    )
    db_session.add(route)
    await db_session.flush()
    our_photo_ids = []
    for i in range(4):
        p = Photo(
            user_id=user.id,
            s3_key_original=f"photos/u/bp4-{i}/original.jpg",
            location=WKTElement("POINT(-122.4 37.8)", srid=4326),
            file_size_bytes=100,
        )
        db_session.add(p)
        await db_session.flush()
        db_session.add(RoutePhoto(route_id=route.id, photo_id=p.id, display_order=i))
        await db_session.flush()
        our_photo_ids.append(p.id)

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos_p1, total, page, per_page = await photo_service.browse_photos(
        db_session, bbox=bbox, page=1, per_page=2
    )
    assert total >= 4
    assert page == 1
    assert per_page == 2
    assert len(photos_p1) == 2

    photos_p2, total2, page2, _ = await photo_service.browse_photos(
        db_session, bbox=bbox, page=2, per_page=2
    )
    assert total2 >= 4
    assert page2 == 2
    assert len(photos_p2) == 2

    all_ids = [p.id for p in photos_p1] + [p.id for p in photos_p2]
    found = sum(1 for pid in our_photo_ids if pid in all_ids)
    assert found >= 1, "at least one of our 4 photos should appear in first two pages (shared DB)"
    full_page = await photo_service.browse_photos(db_session, bbox=bbox, page=1, per_page=100)
    all_returned_ids = [p.id for p in full_page[0]]
    for pid in our_photo_ids:
        assert pid in all_returned_ids, f"our photo {pid} must be in bbox browse result"


@requires_postgres
@pytest.mark.asyncio
async def test_browse_my_photos_returns_only_current_user_photos_in_bbox(
    db_session: AsyncSession,
) -> None:
    """browse_my_photos returns only current user's photos with location inside bbox."""
    owner = User(google_id="myphotos1", email="my1@example.com", name="Owner")
    other = User(google_id="myphotos2", email="my2@example.com", name="Other")
    db_session.add_all([owner, other])
    await db_session.flush()

    owner_photo_in_bbox = Photo(
        user_id=owner.id,
        s3_key_original="photos/owner/inbbox/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    other_photo_in_bbox = Photo(
        user_id=other.id,
        s3_key_original="photos/other/inbbox/original.jpg",
        location=WKTElement("POINT(-122.4 37.8)", srid=4326),
        file_size_bytes=100,
    )
    owner_photo_outside_bbox = Photo(
        user_id=owner.id,
        s3_key_original="photos/owner/outbbox/original.jpg",
        location=WKTElement("POINT(-122.4 38.5)", srid=4326),
        file_size_bytes=100,
    )
    db_session.add_all([owner_photo_in_bbox, other_photo_in_bbox, owner_photo_outside_bbox])
    await db_session.flush()

    bbox = (-122.42, 37.78, -122.38, 37.84)
    photos, total, page, per_page = await photo_service.browse_my_photos(
        db_session,
        user_id=owner.id,
        bbox=bbox,
        page=1,
        per_page=10,
    )

    assert page == 1
    assert per_page == 10
    assert total >= 1
    ids = {p.id for p in photos}
    assert owner_photo_in_bbox.id in ids
    assert owner_photo_outside_bbox.id not in ids
    assert other_photo_in_bbox.id not in ids
