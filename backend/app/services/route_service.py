"""Route CRUD service. See PRD v2 - FR2, Step 3.1."""
from __future__ import annotations

from uuid import UUID

from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from shapely import wkt
from shapely.geometry import LineString
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import RouteForbiddenError, RouteNotFoundError
from app.models.photo import Photo
from app.models.route import Route
from app.models.route_photo import RoutePhoto
from app.models.route_tag import RouteTag
from app.models.tag import Tag
from app.schemas.route import RouteCreate, RouteFromPhotosCreate, RouteUpdate
from app.utils.geometry import distance_meters, validate_linestring, validate_route_geometry
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


async def create_route_from_photos(db: AsyncSession, user_id: UUID, data: RouteFromPhotosCreate) -> Route:
    """Create a route from ordered photo locations. PRD v3 - FR-R1, FR-R2.

    Validates: all photo_ids exist, user owns all, each photo has location set; >=2 photos.
    Route geometry = LineString through photo locations in photo_ids order.
    """
    if len(data.photo_ids) < 2:
        raise ValueError("At least 2 photos are required")
    # Fetch photos in one query; preserve order via dict then iterate photo_ids
    r = await db.execute(select(Photo).where(Photo.id.in_(data.photo_ids)))
    photos_by_id = {p.id: p for p in r.scalars().all()}
    ordered_photos: list[Photo] = []
    for pid in data.photo_ids:
        photo = photos_by_id.get(pid)
        if photo is None:
            raise ValueError(f"Photo {pid} not found")
        if photo.user_id != user_id:
            raise ValueError(f"Photo {pid} is not owned by you")
        if photo.location is None:
            raise ValueError(f"Photo {pid} has no location")
        ordered_photos.append(photo)
    # Build LineString from photo locations in order
    coords: list[list[float]] = []
    for photo in ordered_photos:
        point = to_shape(photo.location)
        coords.append([float(point.x), float(point.y)])
    line = validate_linestring(coords)
    dist = distance_meters(line)
    if dist <= 0:
        raise ValueError("Route distance must be greater than 0 (photos must not all be at the same point)")
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
        distance_meters=dist,
        is_public=data.is_public,
    )
    db.add(route)
    await db.flush()
    await db.refresh(route)
    for tag in tags:
        rt = RouteTag(route_id=route.id, tag_id=tag.id)
        db.add(rt)
    for i, photo in enumerate(ordered_photos):
        rp = RoutePhoto(route_id=route.id, photo_id=photo.id, display_order=i)
        db.add(rp)
    await db.flush()
    r = await db.execute(
        select(Route)
        .where(Route.id == route.id)
        .options(
            selectinload(Route.route_photos).selectinload(RoutePhoto.photo),
            selectinload(Route.route_tags).selectinload(RouteTag.tag),
        )
    )
    return r.scalar_one()


def _route_load_options():
    return (
        selectinload(Route.route_photos).selectinload(RoutePhoto.photo),
        selectinload(Route.route_tags).selectinload(RouteTag.tag),
    )


async def get_routes_by_user(db: AsyncSession, user_id: UUID) -> list[Route]:
    """Return all routes for a user, ordered by updated_at descending."""
    r = await db.execute(
        select(Route)
        .where(Route.user_id == user_id)
        .options(*_route_load_options())
        .order_by(Route.updated_at.desc())
    )
    return list(r.scalars().all())


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


async def recompute_route_geometry_from_photos(db: AsyncSession, route_id: UUID) -> Route | None:
    """Recompute route geometry from photo locations in display_order. PRD v3 - FR-R2.

    Fetches route_photos ordered by display_order, builds LineString from photo locations,
    updates route.route_geometry and route.distance_meters. Call after add/remove/reorder photos.
    Returns the route with updated geometry, or None if route not found.
    If fewer than 2 photos have location: sets geometry to degenerate (single point duplicated)
    so distance=0; if zero photos with location, skips update and returns route unchanged.
    """
    route = await get_route_by_id(db, route_id)
    if route is None:
        return None
    # Query route_photos ordered by display_order so we use current DB order (not cached)
    r = await db.execute(
        select(RoutePhoto)
        .where(RoutePhoto.route_id == route_id)
        .order_by(RoutePhoto.display_order)
        .options(selectinload(RoutePhoto.photo))
    )
    ordered_route_photos = list(r.scalars().all())
    coords: list[list[float]] = []
    for rp in ordered_route_photos:
        if rp.photo.location is not None:
            point = to_shape(rp.photo.location)
            coords.append([float(point.x), float(point.y)])
    if len(coords) == 0:
        return route
    if len(coords) == 1:
        line = LineString([coords[0], coords[0]])
        dist = 0.0
    else:
        line = validate_linestring(coords)
        dist = distance_meters(line)
    route.route_geometry = WKTElement(wkt.dumps(line), srid=4326)
    route.distance_meters = dist
    await db.flush()
    await db.refresh(route)
    return route
