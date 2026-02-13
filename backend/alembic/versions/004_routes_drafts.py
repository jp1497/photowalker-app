"""Add is_draft to routes for draft routes. PRD v3 - Database Changes.

Revision ID: 004
Revises: 003
Create Date: 2026-02-06

Adds is_draft BOOLEAN NOT NULL DEFAULT false and partial index for listing drafts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, Sequence[str], None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_draft column and partial index for user drafts listing."""
    op.add_column(
        "routes",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "idx_routes_is_draft_user",
        "routes",
        ["is_draft", "user_id"],
        unique=False,
        postgresql_where=sa.text("is_draft = true"),
    )


def downgrade() -> None:
    """Remove is_draft column and index."""
    op.drop_index("idx_routes_is_draft_user", table_name="routes")
    op.drop_column("routes", "is_draft")
