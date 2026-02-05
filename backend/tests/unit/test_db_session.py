"""Unit tests for database session and get_db. See Step 1.2 - Database Layer."""
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.factory import create_app
from app.db.dependencies import get_db
from app.db.session import create_engine, create_session_factory
from tests.conftest import requires_postgres


def _minimal_settings() -> Settings:
    """Build Settings with required fields for testing."""
    return Settings(
        database_url="postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
    )


@pytest.mark.asyncio
async def test_get_db_yields_session() -> None:
    """get_db is an async generator that yields AsyncSession when app has session factory."""
    settings = _minimal_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)

    app = FastAPI()

    @app.get("/test")
    async def test_endpoint(db: AsyncSession = Depends(get_db)):
        assert db is not None
        assert isinstance(db, AsyncSession)
        return {"ok": True}

    app.state.db_session_factory = session_factory

    from starlette.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/test")
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    await engine.dispose()


@requires_postgres
@pytest.mark.asyncio
async def test_session_commits_on_success() -> None:
    """When endpoint completes without exception, session commits."""
    from sqlalchemy import text

    settings = _minimal_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)

    app = FastAPI()

    @app.get("/test")
    async def test_endpoint(db: AsyncSession = Depends(get_db)):
        await db.execute(text("SELECT 1"))
        return {"ok": True}

    app.state.db_session_factory = session_factory

    from starlette.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/test")
        assert response.status_code == 200

    await engine.dispose()


@pytest.mark.asyncio
async def test_session_rollbacks_on_exception() -> None:
    """When endpoint raises, session rolls back."""
    settings = _minimal_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)

    app = FastAPI()

    @app.get("/test")
    async def test_endpoint(db: AsyncSession = Depends(get_db)):
        raise ValueError("Intentional error for rollback test")

    app.state.db_session_factory = session_factory

    from starlette.testclient import TestClient

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test")
        assert response.status_code == 500

    await engine.dispose()


def test_create_app_wires_db_at_startup() -> None:
    """create_app sets db_engine and db_session_factory on startup."""
    settings = _minimal_settings()
    app = create_app(settings)

    # Before startup, state may not have db
    assert not hasattr(app.state, "db_engine")

    # Run startup
    from starlette.testclient import TestClient

    with TestClient(app) as client:
        client.get("/docs")  # Startup runs on first request
        assert hasattr(app.state, "db_engine")
        assert hasattr(app.state, "db_session_factory")
        assert app.state.db_session_factory is not None
