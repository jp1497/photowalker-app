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
from app.schemas.route import RouteCreate, RouteResponse, RouteUpdate
from app.services import route_service

router = APIRouter(prefix="/v1/routes", tags=["routes"])


def _route_to_response(route) -> dict:
    """Build route response dict with serialized route and photos in display order."""
    route_data = RouteResponse.model_validate(route).model_dump(mode="json", by_alias=True)
    photos = [PhotoResponse.model_validate(rp.photo).model_dump(mode="json") for rp in route.route_photos]
    return {"route": route_data, "photos": photos}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_route(
    body: RouteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Create a route. Auth required."""
    try:
        route = await route_service.create_route(db, current_user.id, body)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": None,
            },
        )
    return {"route": RouteResponse.model_validate(route).model_dump(mode="json", by_alias=True)}


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
