"""Discovery service: browse public routes by bbox, tags, author. See PRD v2 - FR5, Step 5.1."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import text

from app.core.exceptions import BboxTooLargeError
from app.models.route import Route
from app.models.route_photo import RoutePhoto
from app.models.route_tag import RouteTag
from app.models.tag import Tag

MAX_BBOX_AREA_M2 = 50_000_000  # 50 km² per PRD FR5
DEFAULT_PAGE = 1
DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 50
SORT_CHOICES = ("created_at", "distance")


def _route_load_options():
    """Eager load route_tags and route_photos for serialization."""
    return (
        selectinload(Route.route_photos).selectinload(RoutePhoto.photo),
        selectinload(Route.route_tags).selectinload(RouteTag.tag),
    )


async def _bbox_area_m2(db: AsyncSession, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> float:
    """Return area of bbox in m² using PostGIS geography."""
    r = await db.execute(
        text("SELECT ST_Area(ST_MakeEnvelope(:a, :b, :c, :d, 4326)::geography)"),
        {"a": min_lon, "b": min_lat, "c": max_lon, "d": max_lat},
    )
    row = r.scalar_one_or_none()
    return float(row) if row is not None else 0.0


async def browse_routes(
    db: AsyncSession,
    *,
    bbox: Optional[tuple[float, float, float, float]] = None,
    tags: Optional[list[str]] = None,
    author_id: Optional[UUID] = None,
    page: int = DEFAULT_PAGE,
    per_page: int = DEFAULT_PER_PAGE,
    sort: str = "created_at",
) -> tuple[list[Route], int, int, int]:
    """Browse public routes with optional bbox, tags (AND), author, pagination and sort.

    bbox: (min_lon, min_lat, max_lon, max_lat). Rejected if area > 50 km².
    tags: route must have all of these tags (AND).
    author_id: filter by route owner.
    page, per_page: pagination (per_page capped at MAX_PER_PAGE).
    sort: 'created_at' (newest first) or 'distance' (longest first).

    Returns (routes, total, page, per_page).
    """
    if per_page > MAX_PER_PAGE:
        per_page = MAX_PER_PAGE
    if per_page < 1:
        per_page = DEFAULT_PER_PAGE
    if page < 1:
        page = DEFAULT_PAGE
    if sort not in SORT_CHOICES:
        sort = "created_at"

    # Normalize tag names (lowercase, strip) for filtering
    tag_names = [t.strip().lower() for t in (tags or []) if (t or "").strip()]
    tag_names = list(dict.fromkeys(tag_names))  # preserve order, dedupe

    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        if min_lon > max_lon or min_lat > max_lat:
            return [], 0, page, per_page
        area_m2 = await _bbox_area_m2(db, min_lon, min_lat, max_lon, max_lat)
        if area_m2 > MAX_BBOX_AREA_M2:
            raise BboxTooLargeError()

    base = select(Route).where(Route.is_public.is_(True))

    if author_id is not None:
        base = base.where(Route.user_id == author_id)

    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        envelope = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        base = base.where(func.ST_Intersects(Route.route_geometry, envelope))

    if tag_names:
        # Routes that have all given tags (AND): route_id in (select route_id ... group by route_id having count(distinct tag_id) = len(tag_names))
        tag_subq = (
            select(RouteTag.route_id)
            .join(Tag, RouteTag.tag_id == Tag.id)
            .where(Tag.name.in_(tag_names))
            .group_by(RouteTag.route_id)
            .having(func.count(distinct(Tag.id)) == len(tag_names))
        )
        base = base.where(Route.id.in_(tag_subq))

    # Count total (same filters, no order/limit)
    count_stmt = select(func.count(Route.id)).where(Route.is_public.is_(True))
    if author_id is not None:
        count_stmt = count_stmt.where(Route.user_id == author_id)
    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        envelope = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        count_stmt = count_stmt.where(func.ST_Intersects(Route.route_geometry, envelope))
    if tag_names:
        count_stmt = count_stmt.where(Route.id.in_(tag_subq))
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one() or 0

    if sort == "distance":
        base = base.order_by(Route.distance_meters.desc())
    else:
        base = base.order_by(Route.created_at.desc())

    offset = (page - 1) * per_page
    base = base.offset(offset).limit(per_page)
    base = base.options(*_route_load_options())
    r = await db.execute(base)
    routes = list(r.scalars().unique().all())

    return (routes, total, page, per_page)
