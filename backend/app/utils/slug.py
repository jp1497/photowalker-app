"""Slug generation for routes. Format: {title-slug}-{short-id}. Collision handling. See PRD v2."""
from __future__ import annotations

import re
import secrets
import string
from typing import Awaitable, Callable

SHORT_ID_LENGTH = 8
SLUG_MAX_LENGTH = 255
# We need room for "-" + short_id + optional "-" + suffix
MAX_TITLE_SLUG_LEN = SLUG_MAX_LENGTH - 1 - SHORT_ID_LENGTH - 4  # reserve 4 for "-N" suffix


def _slugify_title(title: str) -> str:
    """Normalize title to URL-safe slug segment: lowercase, alphanumeric and hyphens."""
    s = title.strip().lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s[:MAX_TITLE_SLUG_LEN] if s else "route"


def _short_id() -> str:
    """Return a short alphanumeric id."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(SHORT_ID_LENGTH))


def generate_slug(title: str) -> str:
    """Generate slug from title and random short id. No collision check."""
    base = _slugify_title(title)
    return f"{base}-{_short_id()}"


def ensure_unique_slug(
    slug_candidate: str,
    exists_fn: Callable[[str], bool],
) -> str:
    """Return slug_candidate if unique; otherwise append numeric suffix until unique.

    exists_fn(slug: str) -> bool indicates whether slug is already taken.
    """
    if not exists_fn(slug_candidate):
        return slug_candidate
    base = slug_candidate
    suffix = 1
    while True:
        candidate = f"{base}-{suffix}"
        if len(candidate) > SLUG_MAX_LENGTH:
            base = base[: SLUG_MAX_LENGTH - len(str(suffix)) - 2]
            candidate = f"{base}-{suffix}"
        if not exists_fn(candidate):
            return candidate
        suffix += 1


async def ensure_unique_slug_async(
    slug_candidate: str,
    exists_fn: Callable[[str], Awaitable[bool]],
) -> str:
    """Async variant: exists_fn(slug) is awaited. Returns unique slug."""
    if not await exists_fn(slug_candidate):
        return slug_candidate
    base = slug_candidate
    suffix = 1
    while True:
        candidate = f"{base}-{suffix}"
        if len(candidate) > SLUG_MAX_LENGTH:
            base = base[: SLUG_MAX_LENGTH - len(str(suffix)) - 2]
            candidate = f"{base}-{suffix}"
        if not await exists_fn(candidate):
            return candidate
        suffix += 1
