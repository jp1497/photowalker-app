"""Initial schema: PostGIS, users, routes, photos, tags, route_photos, route_tags.

Revision ID: 001
Revises:
Create Date: 2026-02-05

Per PRD v2 - Schema Details and Migration Strategy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: enable PostGIS, create all tables and indexes."""
    # Idempotent: PostGIS extension (PRD - Migration Strategy).
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis"))

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("google_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_users_google_id", "users", ["google_id"], unique=True)
    op.create_index("idx_users_email", "users", ["email"], unique=True)

    # routes
    op.create_table(
        "routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "route_geometry",
            Geometry(geometry_type="LINESTRING", srid=4326),
            nullable=False,
        ),
        sa.Column("distance_meters", sa.Float(), nullable=False),
        sa.Column("is_public", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_routes_slug", "routes", ["slug"], unique=True)
    op.create_index("idx_routes_user_id", "routes", ["user_id"], unique=False)
    # GIST index on route_geometry is created automatically by GeoAlchemy2 with table DDL.
    op.create_index(
        "idx_routes_public_created",
        "routes",
        ["is_public", "created_at"],
        unique=False,
        postgresql_where=sa.text("is_public = true"),
    )
    op.create_index(
        "idx_routes_created_at",
        "routes",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )

    # photos
    op.create_table(
        "photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("s3_key_original", sa.String(500), nullable=False),
        sa.Column("s3_key_thumbnail", sa.String(500), nullable=True),
        sa.Column(
            "location",
            Geometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("exif_data", postgresql.JSONB(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_photos_user_id", "photos", ["user_id"], unique=False)
    # GIST index on location is created automatically by GeoAlchemy2 with table DDL.
    op.create_index(
        "idx_photos_created_at",
        "photos",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )

    # tags
    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_tags_name", "tags", ["name"], unique=True)

    # route_photos
    op.create_table(
        "route_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("photo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("route_id", "photo_id", name="uq_route_photos_route_photo"),
    )
    op.create_index("idx_route_photos_route_id", "route_photos", ["route_id"], unique=False)
    op.create_index("idx_route_photos_photo_id", "route_photos", ["photo_id"], unique=False)
    op.create_index("idx_route_photos_route_order", "route_photos", ["route_id", "display_order"], unique=False)

    # route_tags
    op.create_table(
        "route_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("route_id", "tag_id", name="uq_route_tags_route_tag"),
    )
    op.create_index("idx_route_tags_route_id", "route_tags", ["route_id"], unique=False)
    op.create_index("idx_route_tags_tag_id", "route_tags", ["tag_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop tables and indexes. PostGIS extension left in place."""
    op.drop_index("idx_route_tags_tag_id", table_name="route_tags")
    op.drop_index("idx_route_tags_route_id", table_name="route_tags")
    op.drop_table("route_tags")

    op.drop_index("idx_route_photos_route_order", table_name="route_photos")
    op.drop_index("idx_route_photos_photo_id", table_name="route_photos")
    op.drop_index("idx_route_photos_route_id", table_name="route_photos")
    op.drop_table("route_photos")

    op.drop_index("idx_tags_name", table_name="tags")
    op.drop_table("tags")

    op.drop_index("idx_photos_created_at", table_name="photos")
    # Drop auto-created GIST index (GeoAlchemy2 names it idx_<table>_<column>).
    op.drop_index("idx_photos_location", table_name="photos", postgresql_using="gist")
    op.drop_index("idx_photos_user_id", table_name="photos")
    op.drop_table("photos")

    op.drop_index("idx_routes_created_at", table_name="routes")
    op.drop_index("idx_routes_public_created", table_name="routes")
    # Drop auto-created GIST index (GeoAlchemy2 names it idx_<table>_<column>).
    op.drop_index("idx_routes_route_geometry", table_name="routes", postgresql_using="gist")
    op.drop_index("idx_routes_user_id", table_name="routes")
    op.drop_index("idx_routes_slug", table_name="routes")
    op.drop_table("routes")

    op.drop_index("idx_users_email", table_name="users")
    op.drop_index("idx_users_google_id", table_name="users")
    op.drop_table("users")
