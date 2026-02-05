"""Google OAuth client - exchange code for user info. See PRD v2 - FR1."""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger(__name__)
import jwt
from jwt import PyJWKSet
from jwt.exceptions import DecodeError, PyJWKError

from app.core.config import Settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"


@dataclass
class GoogleUserInfo:
    """User info from Google OAuth id_token."""

    google_id: str
    email: str
    name: str
    avatar_url: str | None


async def exchange_code_for_user_info(settings: Settings, code: str) -> GoogleUserInfo | None:
    """Exchange Google OAuth authorization code for user info.

    POSTs to Google token endpoint, decodes id_token to get user claims.
    Returns None if code invalid or exchange fails.
    Uses httpx for all HTTPS requests (avoids SSL cert issues with Python urllib on macOS).
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            return None
        data = response.json()
        id_token = data.get("id_token")
        if not id_token:
            return None
        jwks_response = await client.get(GOOGLE_JWKS_URL)
        if jwks_response.status_code != 200:
            return None
        return _decode_google_id_token(id_token, settings.google_client_id, jwks_response.text)


def _decode_google_id_token(id_token: str, client_id: str, jwks_json: str) -> GoogleUserInfo | None:
    """Decode and verify Google id_token JWT. Returns user info or None."""
    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        if not kid:
            log.warning("id_token header missing kid")
            return None
        jwks = PyJWKSet.from_json(jwks_json)
        signing_key = jwks[kid]
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
        )
    except (KeyError, Exception) as e:
        log.warning("id_token decode failed: %s: %s", type(e).__name__, e, exc_info=True)
        return None
    sub = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name")
    picture = payload.get("picture")
    if not sub or not email:
        log.warning("id_token missing sub or email: payload keys=%s", list(payload.keys()))
        return None
    return GoogleUserInfo(
        google_id=sub,
        email=email,
        name=name or email.split("@")[0],
        avatar_url=str(picture) if picture else None,
    )
