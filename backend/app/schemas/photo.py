"""Photo request/response schemas. See PRD v2 - API - Photos."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _point_to_geojson(geom: Any) -> dict[str, Any]:
    """Convert GeoAlchemy2 Point to GeoJSON dict."""
    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping
    return mapping(to_shape(geom))


class PhotoResponse(BaseModel):
    """Photo in API responses. PRD - Photo type. Excludes internal fields (e.g. exif_data)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    caption: Optional[str] = None
    location: dict[str, Any]
    s3_key_original: str
    s3_key_thumbnail: Optional[str] = None
    file_size_bytes: int
    captured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("location", mode="before")
    @classmethod
    def serialize_location(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, dict):
            return v
        return _point_to_geojson(v)


class PhotoUpdate(BaseModel):
    """Request body for PATCH /v1/photos/{id}: caption and route associations."""

    caption: Optional[str] = Field(None, max_length=500)
    route_ids: Optional[list[UUID]] = None
