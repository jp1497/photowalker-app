"""Unit tests for app.services.auth_service."""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.auth.oauth import GoogleUserInfo
from app.core.config import Settings
from app.services.auth_service import (
    create_or_get_user,
    exchange_code_for_user,
    get_user_by_id,
    issue_tokens,
    refresh_tokens,
)


def _minimal_settings() -> Settings:
    """Settings with required fields for auth."""
    return Settings(
        database_url="postgresql+asyncpg://localhost/test",
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
    )


@pytest.fixture
def db_session() -> AsyncMock:
    """Mock async session."""
    return AsyncMock()


@pytest.fixture
def google_info() -> GoogleUserInfo:
    """Sample Google user info."""
    return GoogleUserInfo(
        google_id="google-123",
        email="user@example.com",
        name="Test User",
        avatar_url="https://example.com/avatar.jpg",
    )


@pytest.mark.asyncio
async def test_create_or_get_user_creates_new_user(
    db_session: AsyncMock, google_info: GoogleUserInfo
) -> None:
    """create_or_get_user creates new user when google_id not found."""
    db_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    db_session.flush = AsyncMock()
    db_session.refresh = AsyncMock()
    user = await create_or_get_user(db_session, google_info)
    assert user.google_id == google_info.google_id
    assert user.email == google_info.email
    assert user.name == google_info.name
    assert user.avatar_url == google_info.avatar_url
    db_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_create_or_get_user_returns_existing_user(
    db_session: AsyncMock, google_info: GoogleUserInfo
) -> None:
    """create_or_get_user returns existing user when google_id exists."""
    existing = MagicMock()
    existing.google_id = google_info.google_id
    existing.email = google_info.email
    existing.name = google_info.name
    existing.avatar_url = google_info.avatar_url
    db_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing)))
    db_session.flush = AsyncMock()
    db_session.refresh = AsyncMock()
    user = await create_or_get_user(db_session, google_info)
    assert user is existing
    db_session.add.assert_not_called()


@pytest.mark.asyncio
async def test_issue_tokens_returns_access_and_refresh() -> None:
    """issue_tokens returns access_token and refresh_token."""
    settings = _minimal_settings()
    user_id = uuid4()
    access, refresh = issue_tokens(settings, user_id)
    assert isinstance(access, str)
    assert isinstance(refresh, str)
    assert len(access) > 0
    assert len(refresh) > 0


@pytest.mark.asyncio
async def test_issue_tokens_sets_refresh_cookie() -> None:
    """issue_tokens produces tokens that can be validated (refresh roundtrip)."""
    settings = _minimal_settings()
    user_id = uuid4()
    access, refresh = issue_tokens(settings, user_id)
    decoded_id = refresh_tokens(settings, refresh)
    assert decoded_id == user_id


@pytest.mark.asyncio
async def test_refresh_tokens_returns_user_id_for_valid_token() -> None:
    """refresh_tokens returns user_id from valid refresh token."""
    settings = _minimal_settings()
    user_id = uuid4()
    _, refresh = issue_tokens(settings, user_id)
    decoded = refresh_tokens(settings, refresh)
    assert decoded == user_id


@pytest.mark.asyncio
async def test_refresh_tokens_raises_none_when_invalid() -> None:
    """refresh_tokens returns None when refresh token invalid."""
    settings = _minimal_settings()
    assert refresh_tokens(settings, "invalid-token") is None
    assert refresh_tokens(settings, "") is None


@pytest.mark.asyncio
async def test_exchange_code_for_user_returns_none_when_oauth_fails(
    db_session: AsyncMock,
) -> None:
    """exchange_code_for_user returns None when OAuth exchange fails."""
    settings = _minimal_settings()
    with patch("app.services.auth_service.exchange_code_for_user_info", new_callable=AsyncMock) as mock_oauth:
        mock_oauth.return_value = None
        user = await exchange_code_for_user(settings, db_session, "invalid-code")
    assert user is None


@pytest.mark.asyncio
async def test_exchange_code_for_user_creates_user_when_oauth_succeeds(
    db_session: AsyncMock, google_info: GoogleUserInfo
) -> None:
    """exchange_code_for_user creates/gets user when OAuth succeeds."""
    settings = _minimal_settings()
    db_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    db_session.flush = AsyncMock()
    db_session.refresh = AsyncMock()
    with patch("app.services.auth_service.exchange_code_for_user_info", new_callable=AsyncMock) as mock_oauth:
        mock_oauth.return_value = google_info
        user = await exchange_code_for_user(settings, db_session, "valid-code")
    assert user is not None
    assert user.google_id == google_info.google_id


@pytest.mark.asyncio
async def test_get_user_by_id_returns_user(db_session: AsyncMock) -> None:
    """get_user_by_id returns user when found."""
    user_id = uuid4()
    mock_user = MagicMock()
    mock_user.id = user_id
    db_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_user)))
    user = await get_user_by_id(db_session, user_id)
    assert user is mock_user


@pytest.mark.asyncio
async def test_get_user_by_id_returns_none_when_not_found(db_session: AsyncMock) -> None:
    """get_user_by_id returns None when user not found."""
    db_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    user = await get_user_by_id(db_session, uuid4())
    assert user is None
