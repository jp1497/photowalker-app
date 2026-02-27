"""Photo upload, EXIF, storage, and CRUD. PRD v2 - FR3, Step 4.2; PRD v6 - photos-in-bbox."""
from __future__ import annotations

import uuid
from typing import List, Optional, Tuple
from uuid import UUID

from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import text

from app.core.config import Settings
from app.core.exceptions import BboxTooLargeError, PhotoForbiddenError, PhotoNotFoundError
from app.models.photo import Photo
from app.models.route import Route
from app.models.route_photo import RoutePhoto
from app.storage.s3 import delete_file, photo_original_key, upload_file
from app.utils.exif import MAX_PHOTO_BYTES, extract_captured_at, extract_gps
from app.workers.thumbnail_job import enqueue_thumbnail_job

MAX_PHOTOS_PER_ROUTE = 50
CAPTION_MAX_LEN = 500
JPEG_HEADER = b"\xff\xd8\xff"

# Browse photos by bbox: same limit as discovery (GET /v1/routes). PRD v6 - Step 0.1.
MAX_BBOX_AREA_M2 = 200_000_000  # 200 km²
DEFAULT_PAGE = 1
DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 50


async def upload_photo(
    db: AsyncSession,
    settings: Settings,
    user_id: UUID,
    file_content: bytes,
    content_type: Optional[str],
    caption: Optional[str],
    route_ids: List[UUID],
) -> Photo:
    """Extract EXIF GPS if present; upload to S3; insert photo and route_photos. Enqueues thumbnail job.
    If GPS missing, stores with location=NULL. Allows route_ids=[] for photos uploaded for new route creation."""
    if len(file_content) > MAX_PHOTO_BYTES:
        raise ValueError("Photo exceeds 10MB limit")
    if not file_content.startswith(JPEG_HEADER):
        raise ValueError("Only JPEG images are allowed")
    gps = extract_gps(file_content)
    location: Optional[object] = None
    if gps is not None:
        lat, lon = gps
        location = WKTElement(f"POINT({lon} {lat})", srid=4326)
    caption_clean = (caption or "").strip()[:CAPTION_MAX_LEN] or None

    for rid in route_ids:
        count_result = await db.execute(
            select(func.count()).select_from(RoutePhoto).where(RoutePhoto.route_id == rid)
        )
        if (count_result.scalar() or 0) >= MAX_PHOTOS_PER_ROUTE:
            raise ValueError(f"Route already has maximum of {MAX_PHOTOS_PER_ROUTE} photos")

    photo_id = uuid.uuid4()
    key_original = photo_original_key(user_id, photo_id, "jpg")
    upload_file(settings, key_original, file_content, content_type="image/jpeg")

    captured_at = extract_captured_at(file_content)

    photo = Photo(
        id=photo_id,
        user_id=user_id,
        s3_key_original=key_original,
        s3_key_thumbnail=None,
        location=location,
        caption=caption_clean,
        exif_data=None,
        file_size_bytes=len(file_content),
        captured_at=captured_at,
    )
    db.add(photo)
    await db.flush()

    for i, route_id in enumerate(route_ids):
        rp = RoutePhoto(route_id=route_id, photo_id=photo.id, display_order=i)
        db.add(rp)
    await db.flush()

    enqueue_thumbnail_job(photo.id, settings)

    result = await db.execute(
        select(Photo).where(Photo.id == photo.id).options(selectinload(Photo.route_photos))
    )
    return result.scalar_one()


async def get_photos_by_route(
    db: AsyncSession,
    route_id: UUID,
    order: str = "display_order",
) -> List[Photo]:
    """Return photos for route in display_order (or created_at if order != display_order)."""
    q = (
        select(Photo)
        .join(RoutePhoto, RoutePhoto.photo_id == Photo.id)
        .where(RoutePhoto.route_id == route_id)
    )
    if order == "display_order":
        q = q.order_by(RoutePhoto.display_order, Photo.created_at)
    elif order == "captured_at":
        q = q.order_by(Photo.captured_at.desc().nullslast(), Photo.created_at.desc())
    else:
        q = q.order_by(Photo.created_at.desc())
    result = await db.execute(q)
    return list(result.unique().scalars().all())


async def get_photo_by_id(db: AsyncSession, photo_id: UUID) -> Optional[Photo]:
    """Return photo by id with route_photos loaded, or None."""
    r = await db.execute(
        select(Photo).where(Photo.id == photo_id).options(selectinload(Photo.route_photos))
    )
    return r.scalar_one_or_none()


async def get_photo_by_id_with_routes(db: AsyncSession, photo_id: UUID) -> Optional[Photo]:
    """Return photo by id with route_photos and route loaded (for access check)."""
    r = await db.execute(
        select(Photo)
        .where(Photo.id == photo_id)
        .options(selectinload(Photo.route_photos).selectinload(RoutePhoto.route))
    )
    return r.scalar_one_or_none()


async def _bbox_area_m2(db: AsyncSession, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> float:
    """Return area of bbox in m² using PostGIS geography. Same as discovery_service."""
    r = await db.execute(
        text("SELECT ST_Area(ST_MakeEnvelope(:a, :b, :c, :d, 4326)::geography)"),
        {"a": min_lon, "b": min_lat, "c": max_lon, "d": max_lat},
    )
    row = r.scalar_one_or_none()
    return float(row) if row is not None else 0.0


async def browse_photos(
    db: AsyncSession,
    *,
    bbox: tuple[float, float, float, float],
    page: int = DEFAULT_PAGE,
    per_page: int = DEFAULT_PER_PAGE,
) -> Tuple[List[Photo], int, int, int]:
    """Return photos with location inside bbox that appear on at least one public non-draft route.
    PRD v6 - Step 0.1. bbox: (min_lon, min_lat, max_lon, max_lat). Rejected if area > 200 km².
    Returns (photos, total, page, per_page). Photos have user and route_photos.route loaded."""
    if per_page > MAX_PER_PAGE:
        per_page = MAX_PER_PAGE
    if per_page < 1:
        per_page = DEFAULT_PER_PAGE
    if page < 1:
        page = DEFAULT_PAGE

    min_lon, min_lat, max_lon, max_lat = bbox
    if min_lon > max_lon or min_lat > max_lat:
        return [], 0, page, per_page
    area_m2 = await _bbox_area_m2(db, min_lon, min_lat, max_lon, max_lat)
    if area_m2 > MAX_BBOX_AREA_M2:
        raise BboxTooLargeError()

    envelope = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    # Photos that have location in bbox and are on at least one public non-draft route
    base = (
        select(Photo)
        .join(RoutePhoto, RoutePhoto.photo_id == Photo.id)
        .join(Route, RoutePhoto.route_id == Route.id)
        .where(
            Route.is_public.is_(True),
            Route.is_draft.is_(False),
            Photo.location.isnot(None),
            func.ST_Intersects(Photo.location, envelope),
        )
        .distinct()
    )
    count_stmt = (
        select(func.count(func.distinct(Photo.id)))
        .join(RoutePhoto, RoutePhoto.photo_id == Photo.id)
        .join(Route, RoutePhoto.route_id == Route.id)
        .where(
            Route.is_public.is_(True),
            Route.is_draft.is_(False),
            Photo.location.isnot(None),
            func.ST_Intersects(Photo.location, envelope),
        )
    )
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one() or 0

    offset = (page - 1) * per_page
    base = (
        base.order_by(Photo.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .options(
            selectinload(Photo.user),
            selectinload(Photo.route_photos).selectinload(RoutePhoto.route),
        )
    )
    r = await db.execute(base)
    photos = list(r.unique().scalars().all())
    return (photos, total, page, per_page)


def _validate_location_coords(location_dict: dict) -> tuple[float, float]:
    """Validate GeoJSON Point coordinates. Returns (lon, lat). Raises ValueError if invalid."""
    from app.schemas.photo import _validate_geojson_point
    return _validate_geojson_point(location_dict)


async def update_photo(
    db: AsyncSession,
    photo_id: UUID,
    user_id: UUID,
    caption: Optional[str],
    route_ids: Optional[List[UUID]],
    location: Optional[dict] = None,
) -> Photo:
    """Update caption, route associations, and/or location. Raises PhotoNotFoundError or PhotoForbiddenError."""
    photo = await get_photo_by_id(db, photo_id)
    if photo is None:
        raise PhotoNotFoundError()
    if photo.user_id != user_id:
        raise PhotoForbiddenError()

    if location is not None:
        lon, lat = _validate_location_coords(location)
        photo.location = WKTElement(f"POINT({lon} {lat})", srid=4326)

    if caption is not None:
        photo.caption = caption.strip()[:CAPTION_MAX_LEN] or None

    if route_ids is not None:
        # Validate all route_ids exist and belong to user before touching route_photos
        if route_ids:
            r = await db.execute(
                select(Route.id).where(Route.id.in_(route_ids), Route.user_id == user_id)
            )
            found_ids = {row[0] for row in r.scalars().all()}
            missing = [rid for rid in route_ids if rid not in found_ids]
            if missing:
                raise ValueError(
                    "One or more route IDs not found or you do not have access to them"
                )
        for rid in route_ids:
            count_result = await db.execute(
                select(func.count()).select_from(RoutePhoto).where(RoutePhoto.route_id == rid)
            )
            current = count_result.scalar() or 0
            existing_for_this_photo = any(rp.route_id == rid for rp in photo.route_photos)
            if not existing_for_this_photo and current >= MAX_PHOTOS_PER_ROUTE:
                raise ValueError(f"Route already has maximum of {MAX_PHOTOS_PER_ROUTE} photos")
        for rp in list(photo.route_photos):
            await db.delete(rp)
        await db.flush()
        for i, rid in enumerate(route_ids):
            rp = RoutePhoto(route_id=rid, photo_id=photo.id, display_order=i)
            db.add(rp)
        await db.flush()

    await db.flush()
    await db.refresh(photo)
    return photo


async def delete_photo(db: AsyncSession, settings: Settings, photo_id: UUID, user_id: UUID) -> None:
    """Delete photo from DB and S3 (original + thumbnail). Raises PhotoNotFoundError or PhotoForbiddenError."""
    photo = await get_photo_by_id(db, photo_id)
    if photo is None:
        raise PhotoNotFoundError()
    if photo.user_id != user_id:
        raise PhotoForbiddenError()

    try:
        delete_file(settings, photo.s3_key_original)
    except Exception:
        pass
    if photo.s3_key_thumbnail:
        try:
            delete_file(settings, photo.s3_key_thumbnail)
        except Exception:
            pass

    await db.delete(photo)
    await db.flush()
