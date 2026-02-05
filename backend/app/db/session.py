"""Async database engine and session. See PRD v2 - Database Connection Pooling."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings


def create_engine(settings: Settings):
    """Create async SQLAlchemy engine with connection pool per PRD.

    Pool: size 5-10, overflow 5, timeout 30s, recycle 3600s.
    """
    return create_async_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        pool_recycle=settings.database_pool_recycle,
        echo=settings.debug,
    )


def create_session_factory(engine):
    """Create async session factory with expire_on_commit=False for async."""
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
