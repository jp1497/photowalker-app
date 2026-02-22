"""Thumbnail generation. PRD v2 - FR3: max width, aspect ratio preserved. Tuned for map pins and lists."""
from __future__ import annotations

from io import BytesIO

from PIL import Image

THUMBNAIL_MAX_WIDTH = 800
"""Max width in px; height follows aspect ratio. More pixels = sharper when scaled down to map pins."""
THUMBNAIL_JPEG_QUALITY = 90
"""JPEG quality 1–100. Higher = less compression, clearer at small display size (e.g. map pins). Was 85."""


def resize_to_thumbnail(
    image_bytes: bytes,
    max_width: int = THUMBNAIL_MAX_WIDTH,
    jpeg_quality: int = THUMBNAIL_JPEG_QUALITY,
) -> bytes:
    """Resize JPEG to max_width, preserve aspect ratio. Returns JPEG bytes."""
    img = Image.open(BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((max_width, 10**6), Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, format="JPEG", quality=jpeg_quality, optimize=True)
    return out.getvalue()
