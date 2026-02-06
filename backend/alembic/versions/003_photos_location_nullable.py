"""Make photos.location nullable for photos without GPS. PRD v3 - Database Changes.

Revision ID: 003
Revises: 002
Create Date: 2026-02-06

GIST index on location remains; nulls are excluded from spatial queries.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, Sequence[str], None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow photos.location to be NULL for photos without EXIF GPS."""
    op.execute(sa.text("ALTER TABLE photos ALTER COLUMN location DROP NOT NULL"))


def downgrade() -> None:
    """Re-require photos.location NOT NULL. Existing nulls will fail."""
    op.execute(sa.text("ALTER TABLE photos ALTER COLUMN location SET NOT NULL"))
