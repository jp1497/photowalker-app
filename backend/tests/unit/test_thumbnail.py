"""Unit tests for app.utils.thumbnail."""
from io import BytesIO

from PIL import Image

from app.utils.thumbnail import THUMBNAIL_MAX_WIDTH, resize_to_thumbnail


def _jpeg_bytes(width: int, height: int) -> bytes:
    """Create minimal JPEG of given dimensions."""
    img = Image.new("RGB", (width, height), color=(128, 128, 128))
    out = BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def test_resize_produces_image_under_max_width() -> None:
    """resize_to_thumbnail produces image with width <= 800px."""
    # 1600x800 image -> 800x400
    large = _jpeg_bytes(1600, 800)
    result = resize_to_thumbnail(large)
    img = Image.open(BytesIO(result))
    assert img.width <= THUMBNAIL_MAX_WIDTH
    assert img.height <= 800


def test_resize_preserves_aspect_ratio() -> None:
    """resize_to_thumbnail preserves aspect ratio."""
    # 1600x400 -> 800x200
    large = _jpeg_bytes(1600, 400)
    result = resize_to_thumbnail(large)
    img = Image.open(BytesIO(result))
    ratio_original = 1600 / 400
    ratio_thumb = img.width / img.height
    assert abs(ratio_thumb - ratio_original) < 0.02


def test_resize_small_image_unchanged_dimensions() -> None:
    """Image already under max width is resized to same or smaller (may vary slightly)."""
    small = _jpeg_bytes(400, 300)
    result = resize_to_thumbnail(small)
    img = Image.open(BytesIO(result))
    assert img.width <= THUMBNAIL_MAX_WIDTH
    assert img.width == 400
    assert img.height == 300


def test_resize_returns_jpeg_bytes() -> None:
    """resize_to_thumbnail returns valid JPEG bytes."""
    large = _jpeg_bytes(1000, 500)
    result = resize_to_thumbnail(large)
    assert result[:2] == b"\xff\xd8"
    img = Image.open(BytesIO(result))
    assert img.format == "JPEG"
