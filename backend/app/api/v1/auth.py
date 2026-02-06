"""Auth API endpoints. See PRD v2 - API - Authentication."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException

from app.auth.dependencies import get_current_user_required
from app.core.config import Settings, get_settings
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthGoogleResponse,
    AuthMeResponse,
    AuthRefreshResponse,
    GoogleAuthRequest,
    LogoutResponse,
)
from app.schemas.user import UserResponse, UserUpdate
from app.auth.oauth import GoogleUserInfo
from app.services.auth_service import (
    create_or_get_user,
    exchange_code_for_user,
    get_user_by_id,
    issue_tokens,
    refresh_tokens,
)

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days in seconds

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class TestLoginRequest(BaseModel):
    """Request body for POST /v1/auth/test-login (E2E only)."""

    secret: str = Field(..., min_length=1)


@router.post("/google", response_model=AuthGoogleResponse)
async def auth_google(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    """Exchange Google OAuth code for tokens. Sets refresh_token HTTP-only cookie."""
    user = await exchange_code_for_user(settings, db, body.code)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OAUTH_ERROR",
                "message": "Invalid or expired authorization code",
                "details": None,
            },
        )
    access_token, refresh_token = issue_tokens(settings, user.id)
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "access_token": access_token,
            "user": UserResponse.model_validate(user).model_dump(mode="json"),
        },
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )
    return response


@router.post("/test-login", response_model=AuthGoogleResponse)
async def auth_test_login(
    body: TestLoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    """E2E only: exchange shared secret for tokens. Registered only when E2E_TEST_SECRET is set."""
    if not settings.e2e_test_secret or body.secret != settings.e2e_test_secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Not found", "details": None},
        )
    info = GoogleUserInfo(
        google_id="e2e-test-user",
        email="e2e-test@photowalker.local",
        name="E2E Test User",
        avatar_url=None,
    )
    user = await create_or_get_user(db, info)
    access_token, refresh_token = issue_tokens(settings, user.id)
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "access_token": access_token,
            "user": UserResponse.model_validate(user).model_dump(mode="json"),
        },
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )
    return response


@router.post("/refresh", response_model=AuthRefreshResponse)
async def auth_refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    """Refresh access token from refresh_token cookie."""
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Refresh token missing",
                "details": None,
            },
        )
    user_id = refresh_tokens(settings, refresh_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid or expired refresh token",
                "details": None,
            },
        )
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "User not found",
                "details": None,
            },
        )
    access_token, _ = issue_tokens(settings, user.id)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"access_token": access_token},
    )


@router.post("/logout", response_model=LogoutResponse)
async def auth_logout() -> JSONResponse:
    """Clear refresh_token cookie."""
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Logged out"},
    )
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=AuthMeResponse)
async def auth_me(
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """Return current authenticated user."""
    return {"user": UserResponse.model_validate(current_user)}


@router.patch("/me", response_model=AuthMeResponse)
async def auth_me_update(
    body: UserUpdate,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update current user profile (e.g. default map location)."""
    if body.default_map_lat is not None:
        current_user.default_map_lat = body.default_map_lat
    if body.default_map_lon is not None:
        current_user.default_map_lon = body.default_map_lon
    await db.flush()
    await db.refresh(current_user)
    return {"user": UserResponse.model_validate(current_user)}
