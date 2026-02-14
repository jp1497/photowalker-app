"""Route request/response schemas. GeoJSON for geometry. See PRD v2 - API - Routes."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_TAGS = 5
TITLE_MIN = 1
TITLE_MAX = 100


def _geometry_to_geojson(geom: Any) -> dict[str, Any]:
    """Convert GeoAlchemy2 geometry to GeoJSON dict."""
    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping
    return mapping(to_shape(geom))


class RouteGeometrySchema(BaseModel):
    """GeoJSON LineString for route geometry."""

    type: str = "LineString"
    coordinates: list[list[float]] = Field(..., min_length=2)


class RouteCreate(BaseModel):
    """Request body for creating a route."""

    title: str = Field(..., min_length=TITLE_MIN, max_length=TITLE_MAX)
    description: Optional[str] = None
    route_geometry: RouteGeometrySchema
    slug: Optional[str] = Field(None, max_length=255)
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)
    is_public: bool = False

    @field_validator("tags")
    @classmethod
    def tags_normalized(cls, v: list[str]) -> list[str]:
        """Normalize tag names: strip, lowercase, max 50 chars per tag."""
        out = []
        for t in v:
            name = (t or "").strip().lower()
            if name:
                out.append(name[:50])
        return out[:MAX_TAGS]


class RouteFromPhotosCreate(BaseModel):
    """Request body for creating a route from photo locations. PRD v3 - POST /v1/routes/from-photos."""

    title: str = Field(..., min_length=TITLE_MIN, max_length=TITLE_MAX)
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)
    is_public: bool = False
    photo_ids: list[UUID] = Field(..., min_length=2, description="Ordered photo UUIDs; route geometry = LineString through these in order")
    slug: Optional[str] = Field(None, max_length=255)

    @field_validator("tags")
    @classmethod
    def tags_normalized(cls, v: list[str]) -> list[str]:
        """Normalize tag names: strip, lowercase, max 50 chars per tag."""
        out = []
        for t in v:
            name = (t or "").strip().lower()
            if name:
                out.append(name[:50])
        return out[:MAX_TAGS]


class RouteUpdate(BaseModel):
    """Partial update body for PATCH."""

    title: Optional[str] = Field(None, min_length=TITLE_MIN, max_length=TITLE_MAX)
    description: Optional[str] = None
    route_geometry: Optional[RouteGeometrySchema] = None
    tags: Optional[list[str]] = Field(None, max_length=MAX_TAGS)
    is_public: Optional[bool] = None

    @field_validator("tags")
    @classmethod
    def tags_normalized(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return None
        out = []
        for t in v:
            name = (t or "").strip().lower()
            if name:
                out.append(name[:50])
        return out[:MAX_TAGS]


class RouteResponse(BaseModel):
    """Route response with GeoJSON geometry."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    user_id: UUID
    slug: str
    title: str
    description: Optional[str] = None
    route_geometry: dict[str, Any]
    distance_meters: float
    is_public: bool
    is_draft: bool = False
    created_at: datetime
    updated_at: datetime
    tag_names: list[str] = Field(default_factory=list, serialization_alias="tags")

    @field_validator("route_geometry", mode="before")
    @classmethod
    def serialize_geometry(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, dict):
            return v
        return _geometry_to_geojson(v)
