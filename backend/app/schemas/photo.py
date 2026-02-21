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
    location: Optional[dict[str, Any]] = None
    s3_key_original: str
    s3_key_thumbnail: Optional[str] = None
    file_size_bytes: int
    captured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("location", mode="before")
    @classmethod
    def serialize_location(cls, v: Any) -> Optional[dict[str, Any]]:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        return _point_to_geojson(v)


class PhotoBrowseUser(BaseModel):
    """User summary in photo browse list. PRD v6 - photos-in-bbox."""

    id: UUID
    name: str


class PhotoBrowseItem(BaseModel):
    """Photo item for GET /v1/photos (photos-in-bbox). Map pins and lightbox. PRD v6 - Step 0.1."""

    id: UUID
    caption: Optional[str] = None
    user: PhotoBrowseUser
    route_ids: list[UUID] = Field(default_factory=list, description="Route IDs that contain this photo")
    image_url: str = Field(description="Path to image: GET /v1/photos/{id}/image (supports ?size=thumbnail)")
    location: Optional[dict[str, Any]] = None

    @field_validator("location", mode="before")
    @classmethod
    def serialize_location(cls, v: Any) -> Optional[dict[str, Any]]:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        return _point_to_geojson(v)


def _validate_geojson_point(v: dict[str, Any]) -> tuple[float, float]:
    """Validate GeoJSON Point; return (lon, lat). Raises ValueError if invalid."""
    if not isinstance(v, dict):
        raise ValueError("location must be an object")
    if v.get("type") != "Point":
        raise ValueError("location type must be Point")
    coords = v.get("coordinates")
    if not isinstance(coords, (list, tuple)) or len(coords) < 2:
        raise ValueError("location must have coordinates [lon, lat]")
    lon, lat = float(coords[0]), float(coords[1])
    if not (-180 <= lon <= 180):
        raise ValueError("longitude must be in [-180, 180]")
    if not (-90 <= lat <= 90):
        raise ValueError("latitude must be in [-90, 90]")
    return (lon, lat)


class PhotoUpdate(BaseModel):
    """Request body for PATCH /v1/photos/{id}: caption, route associations, location."""

    caption: Optional[str] = Field(None, max_length=500)
    route_ids: Optional[list[UUID]] = None
    location: Optional[dict[str, Any]] = Field(None, description="GeoJSON Point {type: 'Point', coordinates: [lon, lat]}")

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if v is None:
            return None
        _validate_geojson_point(v)
        return v
