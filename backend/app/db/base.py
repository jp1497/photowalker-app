"""SQLAlchemy declarative base. See PRD v2 - Database Design."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass
