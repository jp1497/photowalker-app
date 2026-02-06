"""Health check endpoints. See PRD v2 - Health Check Endpoints."""
from __future__ import annotations

from typing import Union

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.dependencies import get_db
from app.storage.s3 import check_s3_connection

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Basic application health. Returns 200 if app is running."""
    return {"status": "healthy"}


@router.get("/health/db", response_model=None)
async def health_check_db(db: AsyncSession = Depends(get_db)) -> Union[dict, JSONResponse]:
    """Database connectivity check. Returns 503 if DB unreachable."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
            },
        )


@router.get("/health/storage", response_model=None)
def health_check_storage(settings: Settings = Depends(get_settings)) -> Union[dict, JSONResponse]:
    """S3 connectivity check. Returns 503 if storage unreachable or not configured."""
    try:
        check_s3_connection(settings)
        return {"status": "healthy", "storage": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "storage": "disconnected",
                "error": str(e),
            },
        )
