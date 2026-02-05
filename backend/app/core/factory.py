"""Application factory. See PRD v2 - Application Factory Pattern."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.core.logging import setup_logging
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
        """Startup: e.g. initialize database connection pool (Step 1.2)."""
        pass

    @app.on_event("shutdown")
    async def shutdown() -> None:
        """Shutdown: close database connections gracefully (Step 1.2)."""
        pass

    return app
