"""User schemas. See PRD v2 - API - User response."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    """User response schema. Excludes sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    created_at: datetime
