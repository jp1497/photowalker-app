"""Auth dependencies: get_current_user (optional), get_current_user_required. See PRD v2 - FR1."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.auth.jwt import decode_access_token
from app.core.config import Settings, get_settings
from app.db.dependencies import get_db
from app.models.user import User
from app.services.auth_service import get_user_by_id

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Optional[User]:
    """Optional auth: returns User if valid Bearer token, else None."""
    if credentials is None:
        return None
    user_id = decode_access_token(settings, credentials.credentials)
    if user_id is None:
        return None
    user = await get_user_by_id(db, user_id)
    return user


async def get_current_user_required(
    current_user: Annotated[Optional[User], Depends(get_current_user)],
) -> User:
    """Required auth: returns User or raises 401."""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing authentication token",
                "details": None,
            },
        )
    return current_user
