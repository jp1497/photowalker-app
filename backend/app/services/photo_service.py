"""Photo upload, EXIF, storage, and CRUD. PRD v2 - FR3, Step 4.2."""
from __future__ import annotations

import uuid
from typing import List, Optional
from uuid import UUID

from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.exceptions import PhotoForbiddenError, PhotoNotFoundError
from app.models.photo import Photo
from app.models.route_photo import RoutePhoto
from app.storage.s3 import delete_file, photo_original_key, upload_file
from app.utils.exif import MAX_PHOTO_BYTES, extract_captured_at, extract_gps

MAX_PHOTOS_PER_ROUTE = 50
CAPTION_MAX_LEN = 500
JPEG_HEADER = b"\xff\xd8\xff"


def _enqueue_thumbnail_job(photo_id: UUID) -> None:
    """No-op until Step 4.3 implements thumbnail worker. Called after photo created."""
    pass


async def upload_photo(
    db: AsyncSession,
    settings: Settings,
    user_id: UUID,
    file_content: bytes,
    content_type: Optional[str],
    caption: Optional[str],
    route_ids: List[UUID],
) -> Photo:
    """Extract EXIF GPS, reject if missing; upload to S3; insert photo and route_photos. Enqueues thumbnail job."""
    if len(file_content) > MAX_PHOTO_BYTES:
        raise ValueError("Photo exceeds 10MB limit")
    if not file_content.startswith(JPEG_HEADER):
        raise ValueError("Only JPEG images are allowed")
    gps = extract_gps(file_content)
    if gps is None:
        raise ValueError("Photo has no GPS coordinates in EXIF")
    lat, lon = gps
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
    location = WKTElement(f"POINT({lon} {lat})", srid=4326)

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

    _enqueue_thumbnail_job(photo.id)

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


async def update_photo(
    db: AsyncSession,
    photo_id: UUID,
    user_id: UUID,
    caption: Optional[str],
    route_ids: Optional[List[UUID]],
) -> Photo:
    """Update caption and/or route associations. Raises PhotoNotFoundError or PhotoForbiddenError."""
    photo = await get_photo_by_id(db, photo_id)
    if photo is None:
        raise PhotoNotFoundError()
    if photo.user_id != user_id:
        raise PhotoForbiddenError()

    if caption is not None:
        photo.caption = caption.strip()[:CAPTION_MAX_LEN] or None

    if route_ids is not None:
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
