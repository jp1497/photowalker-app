"""Photo API endpoints. PRD v2 - API - Photos, Step 4.4."""
from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.auth.dependencies import get_current_user_required
from app.core.config import Settings, get_settings
from app.core.exceptions import PhotoForbiddenError, PhotoNotFoundError
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.photo import PhotoResponse, PhotoUpdate
from app.services import photo_service

router = APIRouter(prefix="/v1/photos", tags=["photos"])


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


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    route_ids: str = Form("[]"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Upload photo (JPEG, max 10MB). EXIF GPS required. Request timeout 60s for large uploads."""
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
    """Update photo caption and/or route associations. Owner only."""
    try:
        photo = await photo_service.update_photo(
            db,
            photo_id,
            current_user.id,
            body.caption,
            body.route_ids,
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
