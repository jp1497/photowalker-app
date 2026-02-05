"""Pytest fixtures."""
import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.base import Base
from app.db.session import create_engine, create_session_factory

pytest_plugins = []  # type: list[str]


def _is_postgres_available() -> bool:
    """Check if Postgres is reachable. Used to skip DB-dependent tests."""
    try:
        import asyncio

        from sqlalchemy.ext.asyncio import create_async_engine

        url = os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        )
        engine = create_async_engine(url, pool_pre_ping=True, pool_size=1)

        async def _check():
            async with engine.begin():
                pass
            await engine.dispose()

        asyncio.run(_check())
        return True
    except Exception:
        return False


requires_postgres = pytest.mark.skipif(
    not _is_postgres_available(),
    reason="Postgres not available (run docker compose up -d)",
)


def _minimal_settings() -> Settings:
    """Build Settings with required fields for testing."""
    return Settings(
        database_url=os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        ),
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
    )


@pytest.fixture
def settings() -> Settings:
    """Test settings."""
    return _minimal_settings()


@pytest.fixture
async def db_engine(settings: Settings):
    """Create async engine for tests. Disposed after use."""
    engine = create_engine(settings)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session_factory(db_engine):
    """Session factory for tests."""
    return create_session_factory(db_engine)


async def _init_db(engine) -> None:
    """Create PostGIS extension and tables. Used by tests that need a real DB."""
    from app.models import Photo, Route, RoutePhoto, RouteTag, Tag, User  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(lambda c: Base.metadata.create_all(c))


@pytest.fixture
async def db_session(db_engine, db_session_factory) -> AsyncSession:
    """Transactional session for tests. Creates tables, yields session, rolls back."""
    await _init_db(db_engine)
    async with db_session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()
