"""Route API endpoints. See PRD v2 - API - Routes, Step 3.2."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.auth.dependencies import get_current_user, get_current_user_required
from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.photo import PhotoResponse
from app.schemas.route import (
    RouteFromPhotosCreate,
    RoutePhotoOrder,
    RouteResponse,
    RouteUpdate,
)
from app.services import photo_service, route_service

router = APIRouter(prefix="/v1/routes", tags=["routes"])


def _route_to_response(route) -> dict:
    """Build route response dict with serialized route and photos in display order."""
    route_data = RouteResponse.model_validate(route).model_dump(mode="json", by_alias=True)
    photos = [PhotoResponse.model_validate(rp.photo).model_dump(mode="json") for rp in route.route_photos]
    return {"route": route_data, "photos": photos}


# Static path before GET /{slug} so POST /from-photos is not matched as slug="from-photos" (avoids 405).
@router.post("/from-photos", status_code=status.HTTP_201_CREATED)
async def create_route_from_photos(
    body: RouteFromPhotosCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Create a route from ordered photo locations. PRD v3 - FR-R1. Auth required."""
    try:
        route = await route_service.create_route_from_photos(db, current_user.id, body)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": None,
            },
        )
    payload = {"route": RouteResponse.model_validate(route).model_dump(mode="json", by_alias=True)}
    await db.commit()
    return payload



@router.get("/me")
async def get_my_routes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Get current user's routes. Auth required."""
    routes = await route_service.get_routes_by_user(db, current_user.id)
    return {
        "routes": [RouteResponse.model_validate(r).model_dump(mode="json", by_alias=True) for r in routes],
    }


@router.get("/{route_id}/photos")
async def get_route_photos(
    route_id: UUID,
    order: str = "display_order",
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """Get photos for route. Private routes require owner auth. Order: display_order | captured_at."""
    route = await route_service.get_route_by_id(db, route_id)
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Route not found", "details": None},
        )
    if not route.is_public:
        if current_user is None or current_user.id != route.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Route is private", "details": None},
            )
    if order not in ("display_order", "captured_at"):
        order = "display_order"
    photos = await photo_service.get_photos_by_route(db, route_id, order)
    return {"photos": [PhotoResponse.model_validate(p).model_dump(mode="json") for p in photos]}


@router.get("/{slug}")
async def get_route_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """Get route by slug. Public routes: no auth. Private: requires owner."""
    route = await route_service.get_route_by_slug(db, slug)
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Route not found",
                "details": None,
            },
        )
    if not route.is_public:
        if current_user is None or current_user.id != route.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "Route is private",
                    "details": None,
                },
            )
    return _route_to_response(route)


@router.put("/{route_id}/photos/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_route_photos(
    route_id: UUID,
    body: RoutePhotoOrder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> None:
    """Update photo display_order for a route. Owner only."""
    try:
        await route_service.reorder_route_photos(db, route_id, current_user.id, body.photo_ids)
    except RouteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Route not found", "details": None},
        )
    except RouteForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to reorder photos on this route", "details": None},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e), "details": None},
        )
    await db.commit()


@router.patch("/{route_id}")
async def update_route(
    route_id: UUID,
    body: RouteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Update route. Owner only."""
    try:
        route = await route_service.update_route(db, route_id, current_user.id, body)
    except RouteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Route not found", "details": None},
        )
    except RouteForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to update this route", "details": None},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e), "details": None},
        )
    return {"route": RouteResponse.model_validate(route).model_dump(mode="json", by_alias=True)}


@router.delete("/{route_id}")
async def delete_route(
    route_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Delete route. Owner only."""
    try:
        await route_service.delete_route(db, route_id, current_user.id)
    except RouteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Route not found", "details": None},
        )
    except RouteForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to delete this route", "details": None},
        )
    return {"message": "Deleted"}
