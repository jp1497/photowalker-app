"""Route-Tag junction table. See PRD v2 - Schema Details - route_tags."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from app.db.base import Base


class RouteTag(Base):
    """Association between routes and tags."""

    __tablename__ = "route_tags"
    __table_args__ = (UniqueConstraint("route_id", "tag_id", name="uq_route_tags_route_tag"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    route_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    route: Mapped["Route"] = relationship("Route", back_populates="route_tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="route_tags")
