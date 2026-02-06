"""Auth API schemas. See PRD v2 - API - Authentication."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class GoogleAuthRequest(BaseModel):
    """Request body for POST /v1/auth/google."""

    code: str = Field(..., min_length=1, description="Google OAuth authorization code")


class AuthGoogleResponse(BaseModel):
    """Response for POST /v1/auth/google."""

    access_token: str
    user: UserResponse


class AuthRefreshResponse(BaseModel):
    """Response for POST /v1/auth/refresh."""

    access_token: str


class AuthMeResponse(BaseModel):
    """Response for GET /v1/auth/me."""

    user: UserResponse


class LogoutResponse(BaseModel):
    """Response for POST /v1/auth/logout."""

    message: str = "Logged out"
