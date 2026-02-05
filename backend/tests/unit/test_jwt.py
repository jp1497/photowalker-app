"""Unit tests for app.auth.jwt."""
from uuid import uuid4

from app.auth.jwt import (
    decode_access_token,
    decode_refresh_token,
    encode_access_token,
    encode_refresh_token,
)
from app.core.config import Settings


def _minimal_settings(access_min: int = 15, refresh_days: int = 7) -> Settings:
    """Settings with required fields for auth."""
    return Settings(
        database_url="postgresql+asyncpg://localhost/test",
        secret_key="test-secret-key-for-jwt",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        s3_bucket_name="test",
        jwt_access_token_expire_minutes=access_min,
        jwt_refresh_token_expire_days=refresh_days,
    )


def test_encode_decode_access_token_roundtrip() -> None:
    """Access token encode/decode roundtrip returns same user_id."""
    settings = _minimal_settings()
    user_id = uuid4()
    token = encode_access_token(settings, user_id)
    decoded = decode_access_token(settings, token)
    assert decoded == user_id


def test_encode_decode_refresh_token_roundtrip() -> None:
    """Refresh token encode/decode roundtrip returns same user_id."""
    settings = _minimal_settings()
    user_id = uuid4()
    token = encode_refresh_token(settings, user_id)
    decoded = decode_refresh_token(settings, token)
    assert decoded == user_id


def test_decode_access_token_expired_returns_none() -> None:
    """Expired access token returns None."""
    settings = _minimal_settings(access_min=-1)
    user_id = uuid4()
    token = encode_access_token(settings, user_id)
    decoded = decode_access_token(settings, token)
    assert decoded is None


def test_decode_refresh_token_expired_returns_none() -> None:
    """Expired refresh token returns None."""
    settings = _minimal_settings(refresh_days=-1)
    user_id = uuid4()
    token = encode_refresh_token(settings, user_id)
    decoded = decode_refresh_token(settings, token)
    assert decoded is None


def test_decode_access_token_with_refresh_token_returns_none() -> None:
    """Access decode rejects refresh token type."""
    settings = _minimal_settings()
    user_id = uuid4()
    refresh_token = encode_refresh_token(settings, user_id)
    decoded = decode_access_token(settings, refresh_token)
    assert decoded is None


def test_decode_refresh_token_with_access_token_returns_none() -> None:
    """Refresh decode rejects access token type."""
    settings = _minimal_settings()
    user_id = uuid4()
    access_token = encode_access_token(settings, user_id)
    decoded = decode_refresh_token(settings, access_token)
    assert decoded is None


def test_decode_invalid_token_returns_none() -> None:
    """Invalid token returns None."""
    settings = _minimal_settings()
    assert decode_access_token(settings, "invalid") is None
    assert decode_access_token(settings, "") is None
    assert decode_refresh_token(settings, "not-a-jwt") is None
