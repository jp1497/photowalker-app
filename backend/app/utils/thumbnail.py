"""Thumbnail generation. PRD v2 - FR3: max 800px width, aspect ratio preserved."""
from __future__ import annotations

from io import BytesIO

from PIL import Image

THUMBNAIL_MAX_WIDTH = 800


def resize_to_thumbnail(image_bytes: bytes, max_width: int = THUMBNAIL_MAX_WIDTH) -> bytes:
    """Resize JPEG to max_width (default 800px), preserve aspect ratio. Returns JPEG bytes."""
    img = Image.open(BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((max_width, 10**6), Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()
