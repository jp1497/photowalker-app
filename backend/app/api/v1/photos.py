"""Photo API endpoints. PRD v2 - API - Photos, Step 4.4; PRD v6 - GET /v1/photos (photos-in-bbox)."""
from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.auth.dependencies import get_current_user, get_current_user_required
from app.core.config import Settings, get_settings
from app.core.exceptions import BboxTooLargeError, PhotoForbiddenError, PhotoNotFoundError
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.photo import (
    PhotoBrowseItem,
    PhotoBrowseRouteRef,
    PhotoBrowseUser,
    PhotoResponse,
    PhotoUpdate,
)
from app.services import photo_service
from app.storage.s3 import get_file_content, get_presigned_url

router = APIRouter(prefix="/v1/photos", tags=["photos"])


def _parse_bbox(value: Optional[str]) -> Optional[tuple[float, float, float, float]]:
    """Parse bbox query param 'min_lon,min_lat,max_lon,max_lat'. Returns None if missing/invalid."""
    if not value or not value.strip():
        return None
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 4:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = (float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]))
    except ValueError:
        return None
    if min_lon > max_lon or min_lat > max_lat:
        return None
    return (min_lon, min_lat, max_lon, max_lat)


def _parse_route_ids(value: str) -> list[UUID]:
    """Parse route_ids form value: JSON array of UUID strings."""
    if not value or value.strip() == "[]":
        return []
    try:
        raw = json.loads(value)
        if not isinstance(raw, list):
            return []
        return [UUID(str(x)) for x in raw]
    except (json.JSONDecodeError, ValueError, TypeError):
        return []


@router.get("")
async def browse_photos(
    db: AsyncSession = Depends(get_db),
    bbox: str = Query(..., description="min_lon,min_lat,max_lon,max_lat (required)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=50, description="Items per page"),
) -> dict:
    """Browse photos in viewport (bbox) for map pins and lightbox. PRD v6 - Step 0.1.
    Returns only photos with non-null location inside bbox that appear on at least one public route.
    No auth required. Bbox area max 200 km²."""
    bbox_tuple = _parse_bbox(bbox)
    if bbox_tuple is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "bbox must be min_lon,min_lat,max_lon,max_lat (four numbers)",
                "details": None,
            },
        )
    try:
        photos, total, page_out, per_page_out = await photo_service.browse_photos(
            db, bbox=bbox_tuple, page=page, per_page=per_page
        )
    except BboxTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Bounding box area exceeds maximum (200 km²)",
                "details": None,
            },
        )
    items = []
    for p in photos:
        route_ids = [rp.route_id for rp in p.route_photos]
        routes = [
            PhotoBrowseRouteRef(slug=rp.route.slug, title=rp.route.title)
            for rp in p.route_photos
            if rp.route
        ]
        user = p.user
        items.append(
            PhotoBrowseItem(
                id=p.id,
                caption=p.caption,
                user=PhotoBrowseUser(id=user.id, name=user.name),
                route_ids=route_ids,
                routes=routes,
                image_url=f"/v1/photos/{p.id}/image",
                location=p.location,
            )
        )
    return {
        "photos": [item.model_dump(mode="json") for item in items],
        "pagination": {"page": page_out, "per_page": per_page_out, "total": total},
    }


@router.get("/my")
async def browse_my_photos(
    db: AsyncSession = Depends(get_db),
    bbox: str = Query(..., description="min_lon,min_lat,max_lon,max_lat (required)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=50, description="Items per page"),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Browse current user's photos in viewport (bbox) for My Photos map.
    Returns only photos with non-null location inside bbox, regardless of route visibility.
    Auth required. Bbox area max 200 km².
    """
    bbox_tuple = _parse_bbox(bbox)
    if bbox_tuple is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "bbox must be min_lon,min_lat,max_lon,max_lat (four numbers)",
                "details": None,
            },
        )
    try:
        photos, total, page_out, per_page_out = await photo_service.browse_my_photos(
            db, user_id=current_user.id, bbox=bbox_tuple, page=page, per_page=per_page
        )
    except BboxTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Bounding box area exceeds maximum (200 km²)",
                "details": None,
            },
        )
    items = []
    for p in photos:
        route_ids = [rp.route_id for rp in p.route_photos]
        routes = [
            PhotoBrowseRouteRef(slug=rp.route.slug, title=rp.route.title)
            for rp in p.route_photos
            if rp.route
        ]
        user = p.user
        items.append(
            PhotoBrowseItem(
                id=p.id,
                caption=p.caption,
                user=PhotoBrowseUser(id=user.id, name=user.name),
                route_ids=route_ids,
                routes=routes,
                image_url=f"/v1/photos/{p.id}/image",
                location=p.location,
            )
        )
    return {
        "photos": [item.model_dump(mode="json") for item in items],
        "pagination": {"page": page_out, "per_page": per_page_out, "total": total},
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    route_ids: str = Form("[]"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Upload photo (JPEG, max 10MB). EXIF GPS optional; if missing, location=null. Request timeout 60s for large uploads."""
    content = await file.read()
    route_id_list = _parse_route_ids(route_ids)
    try:
        photo = await photo_service.upload_photo(
            db,
            settings,
            current_user.id,
            content,
            file.content_type,
            caption,
            route_id_list,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": None,
            },
        )
    return {"photo": PhotoResponse.model_validate(photo).model_dump(mode="json")}


@router.patch("/{photo_id}")
async def update_photo(
    photo_id: UUID,
    body: PhotoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Update photo caption, route associations, and/or location. Owner only."""
    try:
        photo = await photo_service.update_photo(
            db,
            photo_id,
            current_user.id,
            body.caption,
            body.route_ids,
            body.location,
        )
    except PhotoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Photo not found", "details": None},
        )
    except PhotoForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to update this photo", "details": None},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e), "details": None},
        )
    return {"photo": PhotoResponse.model_validate(photo).model_dump(mode="json")}


def _can_view_photo(photo, current_user: Optional[User]) -> bool:
    """True if current user (or anonymous) can view this photo. Photo must have route_photos and route loaded."""
    if current_user and photo.user_id == current_user.id:
        return True
    for rp in photo.route_photos:
        if rp.route.is_public:
            return True
        if current_user and rp.route.user_id == current_user.id:
            return True
    return False


@router.get("/{photo_id}/image", response_class=Response)
async def get_photo_image(
    photo_id: UUID,
    size: str = "thumbnail",
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Return image for display: redirect to presigned URL (S3) or stream (local). Thumbnail preferred when available. Access: owner or photo on public/owned route."""
    photo = await photo_service.get_photo_by_id_with_routes(db, photo_id)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Photo not found", "details": None},
        )
    if not _can_view_photo(photo, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to view this photo", "details": None},
        )
    use_thumbnail = size == "thumbnail" and photo.s3_key_thumbnail
    key = photo.s3_key_thumbnail if use_thumbnail else photo.s3_key_original
    url = get_presigned_url(settings, key, expiration=300)
    if url:
        return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
    try:
        content = get_file_content(settings, key)
    except (ValueError, OSError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Image file not found", "details": None},
        )
    return Response(content=content, media_type="image/jpeg")


@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Delete photo (S3 and DB). Owner only."""
    try:
        await photo_service.delete_photo(db, settings, photo_id, current_user.id)
    except PhotoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Photo not found", "details": None},
        )
    except PhotoForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to delete this photo", "details": None},
        )
    return {"message": "Deleted"}
