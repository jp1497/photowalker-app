"""JWT encode/decode for access and refresh tokens. See PRD v2 - FR1, NFR5."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import DecodeError, ExpiredSignatureError

from app.core.config import Settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def _now() -> datetime:
    """Current UTC time."""
    return datetime.now(timezone.utc)


def encode_access_token(settings: Settings, user_id: UUID) -> str:
    """Encode access token (15min expiry per PRD)."""
    expire = _now() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": TOKEN_TYPE_ACCESS,
        "exp": expire,
        "iat": _now(),
    }
    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


def encode_refresh_token(settings: Settings, user_id: UUID) -> str:
    """Encode refresh token (7 days expiry per PRD)."""
    expire = _now() + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": TOKEN_TYPE_REFRESH,
        "exp": expire,
        "iat": _now(),
    }
    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(settings: Settings, token: str) -> UUID | None:
    """Decode access token. Returns user_id or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != TOKEN_TYPE_ACCESS:
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        return UUID(sub)
    except (DecodeError, ExpiredSignatureError, ValueError):
        return None


def decode_refresh_token(settings: Settings, token: str) -> UUID | None:
    """Decode refresh token. Returns user_id or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != TOKEN_TYPE_REFRESH:
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        return UUID(sub)
    except (DecodeError, ExpiredSignatureError, ValueError):
        return None
