"""Auth service: OAuth exchange, user create/get, JWT issue/refresh. See PRD v2 - FR1."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_refresh_token, encode_access_token, encode_refresh_token
from app.auth.oauth import GoogleUserInfo, exchange_code_for_user_info
from app.core.config import Settings
from app.models.user import User


async def exchange_code_for_user(settings: Settings, db: AsyncSession, code: str) -> User | None:
    """Exchange OAuth code for user info. Returns None if code invalid."""
    info = await exchange_code_for_user_info(settings, code)
    if info is None:
        return None
    return await create_or_get_user(db, info)


async def create_or_get_user(db: AsyncSession, info: GoogleUserInfo) -> User:
    """Create new user or return existing by google_id."""
    result = await db.execute(
        select(User).where(User.google_id == info.google_id)
    )
    user = result.scalar_one_or_none()
    if user is not None:
        _update_user_if_changed(user, info)
        await db.flush()
        await db.refresh(user)
        return user
    user = User(
        google_id=info.google_id,
        email=info.email,
        name=info.name,
        avatar_url=info.avatar_url,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


def _update_user_if_changed(user: User, info: GoogleUserInfo) -> None:
    """Update user fields if they differ from Google info."""
    if user.name != info.name:
        user.name = info.name
    if user.avatar_url != info.avatar_url:
        user.avatar_url = info.avatar_url
    if user.email != info.email:
        user.email = info.email


def issue_tokens(settings: Settings, user_id: UUID) -> tuple[str, str]:
    """Issue access and refresh tokens. Returns (access_token, refresh_token)."""
    access = encode_access_token(settings, user_id)
    refresh = encode_refresh_token(settings, user_id)
    return access, refresh


def refresh_tokens(settings: Settings, refresh_token: str) -> UUID | None:
    """Validate refresh token and return user_id. Returns None if invalid."""
    return decode_refresh_token(settings, refresh_token)


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    """Fetch user by id."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


def logout() -> None:
    """Logout: clear refresh cookie on client. No server-side token storage in MVP."""
    pass
