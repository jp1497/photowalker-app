"""Rate limiting middleware. See PRD v2 - NFR4 Rate Limiting."""
from __future__ import annotations

import asyncio
import time
from typing import Optional
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.auth.jwt import decode_access_token
from app.core.config import Settings

# Paths excluded from rate limiting (health, docs)
SKIP_PATHS = frozenset({"/health", "/docs", "/redoc", "/openapi.json"})


class InMemoryRateLimitStore:
    """In-memory fixed-window rate limit store. Prunes old buckets on access."""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._windows: dict[str, float] = {}  # key -> window end time
        self._lock = asyncio.Lock()

    def _prune(self, now: float) -> None:
        """Remove keys whose window has passed."""
        to_del = [k for k, end in self._windows.items() if end <= now]
        for k in to_del:
            self._counts.pop(k, None)
            self._windows.pop(k, None)

    async def check_and_inc(
        self,
        key: str,
        limit: int,
        window_seconds: float,
    ) -> tuple[bool, int]:
        """
        Check if key is under limit, increment count, return (allowed, retry_after_seconds).
        retry_after_seconds is 0 if allowed, else seconds until window resets.
        """
        now = time.monotonic()
        async with self._lock:
            self._prune(now)
            window_end = self._windows.get(key)
            if window_end is not None and window_end <= now:
                window_end = None
            if window_end is None:
                window_end = now + window_seconds
                self._windows[key] = window_end
                self._counts[key] = 0
            count = self._counts[key]
            if count >= limit:
                retry_after = max(0, int(window_end - now))
                return False, retry_after
            self._counts[key] = count + 1
            return True, 0


# Module-level store (single process). For multi-process would use Redis.
_store: Optional[InMemoryRateLimitStore] = None


def get_rate_limit_store() -> InMemoryRateLimitStore:
    """Return the shared in-memory rate limit store."""
    global _store
    if _store is None:
        _store = InMemoryRateLimitStore()
    return _store


def _client_ip(request: Request) -> str:
    """Client IP: X-Forwarded-For rightmost (client) or request.client.host."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _get_user_id_from_request(request: Request, settings: Settings) -> Optional[UUID]:
    """Parse Bearer token and decode to user_id; return None if missing/invalid."""
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    return decode_access_token(settings, token)


async def _check_limits(
    request: Request,
    settings: Settings,
    store: InMemoryRateLimitStore,
) -> tuple[bool, int]:
    """
    Apply rate limits. Return (allowed, retry_after_seconds).
    Limits: 100/min IP, 500/min user, 10 uploads/min user, 5 routes/hour user.
    """
    path = request.scope.get("path", "")
    if path in SKIP_PATHS:
        return True, 0

    method = request.scope.get("method", "GET")
    ip = _client_ip(request)
    user_id = _get_user_id_from_request(request, settings)

    # Fixed window: use wall-clock minute/hour for stable buckets across requests
    now_ts = time.time()
    minute_bucket = int(now_ts // 60)
    hour_bucket = int(now_ts // 3600)

    if user_id is not None:
        # Authenticated: user global limit 500/min
        user_key = f"user:{user_id}:min:{minute_bucket}"
        allowed, retry = await store.check_and_inc(
            user_key,
            settings.rate_limit_user_per_minute,
            60.0,
        )
        if not allowed:
            return False, retry

        # Endpoint-specific: uploads 10/min, routes 5/hour
        if method == "POST" and path.rstrip("/") == "/v1/photos":
            upload_key = f"user:{user_id}:upload:{minute_bucket}"
            allowed, retry = await store.check_and_inc(
                upload_key,
                settings.rate_limit_uploads_per_minute,
                60.0,
            )
            if not allowed:
                return False, retry
        if method == "POST" and path.rstrip("/") == "/v1/routes":
            route_key = f"user:{user_id}:route:{hour_bucket}"
            allowed, retry = await store.check_and_inc(
                route_key,
                settings.rate_limit_routes_per_hour,
                3600.0,
            )
            if not allowed:
                return False, retry
    else:
        # Unauthenticated: IP limit 100/min
        ip_key = f"ip:{ip}:min:{minute_bucket}"
        allowed, retry = await store.check_and_inc(
            ip_key,
            settings.rate_limit_ip_per_minute,
            60.0,
        )
        if not allowed:
            return False, retry

    return True, 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that enforces NFR4 rate limits and returns 429 with Retry-After."""

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self._settings = settings
        self._store = get_rate_limit_store()

    async def dispatch(self, request: Request, call_next) -> Response:
        allowed, retry_after = await _check_limits(request, self._settings, self._store)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please try again later.",
                        "details": None,
                    }
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )
        return await call_next(request)
