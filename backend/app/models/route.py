"""Route model with PostGIS geometry. See PRD v2 - Schema Details - routes."""
from __future__ import annotations

import uuid
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from app.db.base import Base


class Route(Base):
    """Photowalk route with LineString geometry."""

    __tablename__ = "routes"

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
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    route_geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326),
        nullable=False,
    )
    distance_meters: Mapped[float] = mapped_column(Float, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
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

    user: Mapped["User"] = relationship("User", back_populates="routes")
    route_photos: Mapped[list["RoutePhoto"]] = relationship(
        "RoutePhoto",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RoutePhoto.display_order",
    )
    route_tags: Mapped[list["RouteTag"]] = relationship(
        "RouteTag",
        back_populates="route",
        cascade="all, delete-orphan",
    )

    @property
    def tag_names(self) -> list[str]:
        """Tag names for serialization (e.g. RouteResponse). Requires route_tags and tag loaded."""
        return [rt.tag.name for rt in self.route_tags]
