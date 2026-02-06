"""Add default_map_lat, default_map_lon to users for preferred map center.

Revision ID: 002
Revises: 001
Create Date: 2026-02-06

Stores user's preferred map location (e.g. from browser geolocation) for Browse/Create map default.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, Sequence[str], None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_map_lat", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("default_map_lon", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "default_map_lon")
    op.drop_column("users", "default_map_lat")
