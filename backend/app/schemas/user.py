"""User schemas. See PRD v2 - API - User response."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class UserResponse(BaseModel):
    """User response schema. Excludes sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    default_map_lat: Optional[float] = None
    default_map_lon: Optional[float] = None
    created_at: datetime


class UserUpdate(BaseModel):
    """Request body for PATCH /v1/auth/me (profile update)."""

    default_map_lat: Optional[float] = None
    default_map_lon: Optional[float] = None
