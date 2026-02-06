"""Browse/public discovery endpoints. See PRD v2 - GET /v1/routes, Step 5.2."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.core.exceptions import BboxTooLargeError
from app.db.dependencies import get_db
from app.schemas.route import RouteResponse
from app.services import discovery_service

router = APIRouter(prefix="/v1", tags=["discovery"])


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


@router.get("/routes")
async def browse_routes(
    db: AsyncSession = Depends(get_db),
    bbox: Optional[str] = Query(None, description="min_lon,min_lat,max_lon,max_lat"),
    tags: Optional[str] = Query(None, description="Comma-separated tag names"),
    author_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=50, description="Items per page"),
    sort: str = Query("created_at", description="created_at | distance"),
) -> dict:
    """Browse public routes by viewport (bbox), tags, author. No auth required."""
    bbox_tuple: Optional[tuple[float, float, float, float]] = None
    if bbox is not None:
        bbox_tuple = _parse_bbox(bbox)
        if bbox is not None and bbox_tuple is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "bbox must be min_lon,min_lat,max_lon,max_lat (four numbers)",
                    "details": None,
                },
            )

    tag_list: Optional[list[str]] = None
    if tags is not None and tags.strip():
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    try:
        routes, total, page_out, per_page_out = await discovery_service.browse_routes(
            db,
            bbox=bbox_tuple,
            tags=tag_list,
            author_id=author_id,
            page=page,
            per_page=per_page,
            sort=sort if sort in ("created_at", "distance") else "created_at",
        )
    except BboxTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Bounding box area exceeds maximum (50 km²)",
                "details": None,
            },
        )

    return {
        "routes": [RouteResponse.model_validate(r).model_dump(mode="json", by_alias=True) for r in routes],
        "pagination": {"page": page_out, "per_page": per_page_out, "total": total},
    }
