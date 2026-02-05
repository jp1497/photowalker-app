"""Photo response schema for API. See PRD v2 - API - Routes (GET returns photos)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


def _point_to_geojson(geom: Any) -> dict[str, Any]:
    """Convert GeoAlchemy2 Point to GeoJSON dict."""
    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping
    return mapping(to_shape(geom))


class PhotoResponse(BaseModel):
    """Photo in route detail response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    caption: Optional[str] = None
    location: dict[str, Any]
    s3_key_original: str
    s3_key_thumbnail: Optional[str] = None
    captured_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("location", mode="before")
    @classmethod
    def serialize_location(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, dict):
            return v
        return _point_to_geojson(v)
