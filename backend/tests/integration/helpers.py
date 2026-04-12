"""Shared route-creation helpers for integration tests."""
from __future__ import annotations

import asyncio
from uuid import UUID

from app.core.config import Settings
from app.db.session import create_engine, create_session_factory
from app.models.route import Route
from app.services import route_service


async def _create_route(settings: Settings, user_id: UUID, **overrides) -> Route:
    """Create a route directly via service layer (bypasses HTTP)."""
    from app.schemas.route import RouteCreate, RouteGeometrySchema

    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    data = RouteCreate(
        title=overrides.get("title", "Test Walk"),
        description=overrides.get("description", "A test route"),
        route_geometry=RouteGeometrySchema(
            type="LineString",
            coordinates=overrides.get("coordinates", [[-122.4, 37.8], [-122.41, 37.81]]),
        ),
        tags=overrides.get("tags", []),
        is_public=overrides.get("is_public", True),
        slug=overrides.get("slug"),
    )
    async with session_factory() as session:
        route = await route_service.create_route(session, user_id, data)
        await session.commit()
        await session.refresh(route)
    await engine.dispose()
    return route


def create_route_sync(settings: Settings, user_id: UUID, **overrides) -> Route:
    """Create a route directly via service layer. Synchronous wrapper."""
    return asyncio.run(_create_route(settings, user_id, **overrides))
