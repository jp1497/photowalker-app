"""Unit tests for app.utils.exif."""
from unittest.mock import MagicMock, patch

from app.utils.exif import extract_captured_at, extract_gps

# Minimal valid JPEG (no EXIF): SOI + EOI
MINIMAL_JPEG = b"\xff\xd8\xff\xd9"


def test_extract_gps_returns_none_for_empty_content() -> None:
    """extract_gps returns None for empty bytes."""
    assert extract_gps(b"") is None


def test_extract_gps_returns_none_for_image_without_gps() -> None:
    """extract_gps returns None for JPEG without EXIF GPS."""
    assert extract_gps(MINIMAL_JPEG) is None


def test_extract_gps_returns_none_for_invalid_content() -> None:
    """extract_gps returns None when EXIF parsing fails."""
    assert extract_gps(b"not a jpeg at all") is None


def test_extract_gps_from_mock_exif_with_gps() -> None:
    """extract_gps returns (lat, lon) when EXIF has GPS tags (mocked)."""
    # 37 deg 46 min 0 sec N -> 37.7666..., 122 deg 25 min 0 sec W -> -122.4166...
    class FakeRatio:
        def __init__(self, num: int, den: int = 1) -> None:
            self.num = num
            self.den = den

    tags = {
        "GPS GPSLatitude": MagicMock(values=[FakeRatio(37), FakeRatio(46), FakeRatio(0)]),
        "GPS GPSLongitude": MagicMock(values=[FakeRatio(122), FakeRatio(25), FakeRatio(0)]),
        "GPS GPSLatitudeRef": "N",
        "GPS GPSLongitudeRef": "W",
    }
    with patch("app.utils.exif.exifread.process_file", return_value=tags):
        result = extract_gps(MINIMAL_JPEG)
    assert result is not None
    lat, lon = result
    assert abs(lat - (37 + 46 / 60)) < 0.001
    assert abs(lon - (-(122 + 25 / 60))) < 0.001


def test_extract_gps_south_west_negates() -> None:
    """extract_gps applies S/W sign (negative lat/lon)."""
    class FakeRatio:
        def __init__(self, num: int, den: int = 1) -> None:
            self.num = num
            self.den = den

    tags = {
        "GPS GPSLatitude": MagicMock(values=[FakeRatio(33), FakeRatio(55), FakeRatio(0)]),
        "GPS GPSLongitude": MagicMock(values=[FakeRatio(18), FakeRatio(25), FakeRatio(0)]),
        "GPS GPSLatitudeRef": "S",
        "GPS GPSLongitudeRef": "W",
    }
    with patch("app.utils.exif.exifread.process_file", return_value=tags):
        result = extract_gps(MINIMAL_JPEG)
    assert result is not None
    lat, lon = result
    assert lat < 0
    assert lon < 0


def test_extract_captured_at_returns_none_for_empty() -> None:
    """extract_captured_at returns None for empty content."""
    assert extract_captured_at(b"") is None


def test_extract_captured_at_returns_none_when_no_tag() -> None:
    """extract_captured_at returns None when DateTimeOriginal missing."""
    with patch("app.utils.exif.exifread.process_file", return_value={}):
        assert extract_captured_at(MINIMAL_JPEG) is None


def test_extract_captured_at_parses_exif_datetime() -> None:
    """extract_captured_at parses EXIF DateTimeOriginal format."""
    tags = {"EXIF DateTimeOriginal": "2023:06:15 14:30:00"}
    with patch("app.utils.exif.exifread.process_file", return_value=tags):
        dt = extract_captured_at(MINIMAL_JPEG)
    assert dt is not None
    assert dt.year == 2023
    assert dt.month == 6
    assert dt.day == 15
    assert dt.hour == 14
    assert dt.minute == 30
    assert dt.second == 0
