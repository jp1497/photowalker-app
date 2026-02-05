"""Application factory. See PRD v2 - Application Factory Pattern."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.core.logging import setup_logging
from app.db.session import create_engine, create_session_factory
from app.middleware.error_handler import register_error_handlers


def create_app(settings: Settings) -> FastAPI:
    """Create and configure the FastAPI application."""
    setup_logging(settings.environment)

    app = FastAPI(
        title="Photowalker API",
        version="1.0.0",
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url="/redoc" if settings.environment == "development" else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["*"],
        max_age=3600,
    )

    register_error_handlers(app)

    @app.on_event("startup")
    async def startup() -> None:
        """Initialize database connection pool per PRD v2."""
        engine = create_engine(settings)
        app.state.db_engine = engine
        app.state.db_session_factory = create_session_factory(engine)

    @app.on_event("shutdown")
    async def shutdown() -> None:
        """Close database connections gracefully."""
        engine = getattr(app.state, "db_engine", None)
        if engine is not None:
            await engine.dispose()

    return app
