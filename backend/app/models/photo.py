"""Photo model with PostGIS Point geometry. See PRD v2 - Schema Details - photos."""
from __future__ import annotations

import uuid
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from app.db.base import Base


class Photo(Base):
    """Photo with Point geometry from EXIF GPS."""

    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    s3_key_original: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_key_thumbnail: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exif_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="photos")
    route_photos: Mapped[list["RoutePhoto"]] = relationship(
        "RoutePhoto",
        back_populates="photo",
        cascade="all, delete-orphan",
    )
