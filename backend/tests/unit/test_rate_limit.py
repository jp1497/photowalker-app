"""Unit tests for rate limiting middleware."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.config import Settings
from app.middleware.rate_limit import (
    RateLimitMiddleware,
    SKIP_PATHS,
    _client_ip,
)


def _minimal_settings(**overrides: object) -> Settings:
    """Settings with rate limits overridable for tests."""
    defaults = {
        "database_url": "postgresql+asyncpg://u:p@localhost/db",
        "secret_key": "test-secret",
        "google_client_id": "test",
        "google_client_secret": "test",
        "google_redirect_uri": "http://localhost/callback",
        "aws_access_key_id": "test",
        "aws_secret_access_key": "test",
        "s3_bucket_name": "test",
        "rate_limit_ip_per_minute": 2,
        "rate_limit_user_per_minute": 10,
        "rate_limit_uploads_per_minute": 5,
        "rate_limit_routes_per_hour": 3,
    }
    return Settings(**{**defaults, **overrides})


def test_rate_limit_returns_429_when_exceeded() -> None:
    """Rate limit middleware returns 429 with Retry-After when limit exceeded."""
    settings = _minimal_settings(rate_limit_ip_per_minute=2)
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, settings=settings)

    @app.get("/api/foo")
    async def foo() -> dict:
        return {"ok": True}

    # Use a distinct IP so this test does not share store state with other runs
    client = TestClient(app, headers={"X-Forwarded-For": "192.0.2.1"})
    r1 = client.get("/api/foo")
    assert r1.status_code == 200
    r2 = client.get("/api/foo")
    assert r2.status_code == 200
    r3 = client.get("/api/foo")
    assert r3.status_code == 429
    assert "Retry-After" in r3.headers
    assert int(r3.headers["Retry-After"]) >= 0
    data = r3.json()
    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert "Too many requests" in data["error"]["message"]


def test_skip_paths_not_rate_limited() -> None:
    """Health and docs paths are not rate limited."""
    settings = _minimal_settings(rate_limit_ip_per_minute=1)
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, settings=settings)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    client = TestClient(app)
    for _ in range(5):
        r = client.get("/health")
        assert r.status_code == 200


def test_client_ip_from_x_forwarded_for() -> None:
    """Client IP uses rightmost X-Forwarded-For when present."""
    request = MagicMock(spec=Request)
    request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
    request.client = None
    assert _client_ip(request) == "5.6.7.8"


def test_client_ip_from_request_client() -> None:
    """Client IP uses request.client.host when no X-Forwarded-For."""
    request = MagicMock(spec=Request)
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "192.168.1.1"
    assert _client_ip(request) == "192.168.1.1"


def test_skip_paths_defined() -> None:
    """Skip paths include health and docs."""
    assert "/health" in SKIP_PATHS
    assert "/docs" in SKIP_PATHS
    assert "/openapi.json" in SKIP_PATHS
