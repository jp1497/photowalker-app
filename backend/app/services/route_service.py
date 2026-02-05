"""Route CRUD service. See PRD v2 - FR2, Step 3.1."""
from __future__ import annotations

from uuid import UUID

from geoalchemy2.elements import WKTElement
from shapely import wkt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.models.route import Route
from app.models.route_tag import RouteTag
from app.models.tag import Tag
from app.schemas.route import RouteCreate, RouteUpdate
from app.utils.geometry import validate_route_geometry
from app.utils.slug import ensure_unique_slug_async, generate_slug


async def _slug_exists(db: AsyncSession, slug: str) -> bool:
    """Return True if a route with this slug exists."""
    r = await db.execute(select(Route.id).where(Route.slug == slug))
    return r.scalar_one_or_none() is not None


async def _get_or_create_tags(db: AsyncSession, names: list[str]) -> list[Tag]:
    """Resolve tag names to Tag instances; create missing tags. Names assumed normalized (lowercase)."""
    if not names:
        return []
    seen: set[str] = set()
    result: list[Tag] = []
    for name in names:
        if not name or name in seen:
            continue
        seen.add(name)
        name = name.strip().lower()[:50]
        if not name:
            continue
        r = await db.execute(select(Tag).where(Tag.name == name))
        tag = r.scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
            await db.refresh(tag)
        result.append(tag)
    return result


async def create_route(db: AsyncSession, user_id: UUID, data: RouteCreate) -> Route:
    """Create a route. Validates geometry, generates unique slug, inserts route and tags."""
    geom_dict = data.route_geometry.model_dump()
    line, distance_meters = validate_route_geometry(geom_dict)

    slug_candidate = (data.slug or "").strip() or generate_slug(data.title)
    slug = await ensure_unique_slug_async(slug_candidate, lambda s: _slug_exists(db, s))

    tags = await _get_or_create_tags(db, data.tags)

    wkt_geom = wkt.dumps(line)
    route_geometry = WKTElement(wkt_geom, srid=4326)

    route = Route(
        user_id=user_id,
        slug=slug,
        title=data.title.strip(),
        description=(data.description or "").strip() or None,
        route_geometry=route_geometry,
        distance_meters=distance_meters,
        is_public=data.is_public,
    )
    db.add(route)
    await db.flush()
    await db.refresh(route)

    for tag in tags:
        rt = RouteTag(route_id=route.id, tag_id=tag.id)
        db.add(rt)
    await db.flush()

    r = await db.execute(
        select(Route)
        .where(Route.id == route.id)
        .options(
            selectinload(Route.route_photos),
            selectinload(Route.route_tags).selectinload(RouteTag.tag),
        )
    )
    return r.scalar_one()


def _route_load_options():
    return selectinload(Route.route_photos), selectinload(Route.route_tags).selectinload(RouteTag.tag)


async def get_route_by_slug(db: AsyncSession, slug: str) -> Route | None:
    """Return route by slug with photos and tags loaded, or None if not found."""
    r = await db.execute(
        select(Route)
        .where(Route.slug == slug)
        .options(*_route_load_options())
    )
    return r.scalar_one_or_none()


async def get_route_by_id(db: AsyncSession, route_id: UUID) -> Route | None:
    """Return route by id with photos and tags loaded, or None if not found."""
    r = await db.execute(
        select(Route)
        .where(Route.id == route_id)
        .options(*_route_load_options())
    )
    return r.scalar_one_or_none()


async def update_route(db: AsyncSession, route_id: UUID, user_id: UUID, data: RouteUpdate) -> Route:
    """Update route. Raises RouteNotFoundError or RouteForbiddenError."""
    route = await get_route_by_id(db, route_id)
    if route is None:
        raise RouteNotFoundError()
    if route.user_id != user_id:
        raise RouteForbiddenError()

    if data.title is not None:
        route.title = data.title.strip()
    if data.description is not None:
        route.description = data.description.strip() or None
    if data.is_public is not None:
        route.is_public = data.is_public

    if data.route_geometry is not None:
        geom_dict = data.route_geometry.model_dump()
        line, distance_meters = validate_route_geometry(geom_dict)
        route.route_geometry = WKTElement(wkt.dumps(line), srid=4326)
        route.distance_meters = distance_meters

    if data.tags is not None:
        # Replace route_tags
        for rt in list(route.route_tags):
            await db.delete(rt)
        await db.flush()
        tags = await _get_or_create_tags(db, data.tags)
        for tag in tags:
            rt = RouteTag(route_id=route.id, tag_id=tag.id)
            db.add(rt)
        await db.flush()

    await db.flush()
    await db.refresh(route)
    # Reload with relationships
    r = await db.execute(
        select(Route).where(Route.id == route_id).options(*_route_load_options())
    )
    return r.scalar_one()


async def delete_route(db: AsyncSession, route_id: UUID, user_id: UUID) -> None:
    """Delete route. Raises RouteNotFoundError or RouteForbiddenError."""
    route = await get_route_by_id(db, route_id)
    if route is None:
        raise RouteNotFoundError()
    if route.user_id != user_id:
        raise RouteForbiddenError()
    await db.delete(route)
    await db.flush()
