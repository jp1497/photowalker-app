"""EXIF extraction from JPEG. PRD v2 - FR3: GPS from EXIF, reject if missing."""
from __future__ import annotations

import io
from datetime import datetime
from typing import Optional, Tuple, Union

import exifread

# Tag names (ExifRead uses "IFD Tag" format)
_GPS_LAT = "GPS GPSLatitude"
_GPS_LAT_REF = "GPS GPSLatitudeRef"
_GPS_LON = "GPS GPSLongitude"
_GPS_LON_REF = "GPS GPSLongitudeRef"
_DATETIME_ORIGINAL = "EXIF DateTimeOriginal"

# Max file size PRD: 10MB
MAX_PHOTO_BYTES = 10 * 1024 * 1024


def _ratio_to_float(tag) -> float:
    """Convert ExifRead Ratio or list of Ratio (d,m,s) to decimal degrees."""
    if hasattr(tag, "values") and len(tag.values) >= 3:
        d, m, s = tag.values[0], tag.values[1], tag.values[2]
        deg = float(d.num) / float(d.den) if hasattr(d, "num") else float(d)
        mn = float(m.num) / float(m.den) if hasattr(m, "num") else float(m)
        sec = float(s.num) / float(s.den) if hasattr(s, "num") else float(s)
        return deg + mn / 60.0 + sec / 3600.0
    if hasattr(tag, "num") and hasattr(tag, "den"):
        return float(tag.num) / float(tag.den)
    return float(tag)


def extract_gps(file_content: Union[bytes, bytearray]) -> Optional[Tuple[float, float]]:
    """Extract GPS (lat, lon) in WGS84 from JPEG EXIF. Returns None if no GPS data."""
    if not file_content:
        return None
    try:
        tags = exifread.process_file(io.BytesIO(file_content), details=False)
    except Exception:
        return None
    lat_tag = tags.get(_GPS_LAT)
    lon_tag = tags.get(_GPS_LON)
    lat_ref = tags.get(_GPS_LAT_REF)
    lon_ref = tags.get(_GPS_LON_REF)
    if not lat_tag or not lon_tag:
        return None
    try:
        lat = _ratio_to_float(lat_tag)
        lon = _ratio_to_float(lon_tag)
        if lat_ref and str(lat_ref).strip().upper() == "S":
            lat = -lat
        if lon_ref and str(lon_ref).strip().upper() == "W":
            lon = -lon
        return (lat, lon)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def extract_captured_at(file_content: Union[bytes, bytearray]) -> Optional[datetime]:
    """Extract EXIF DateTimeOriginal as timezone-naive UTC. Returns None if missing or unparseable."""
    if not file_content:
        return None
    try:
        tags = exifread.process_file(io.BytesIO(file_content), details=False)
    except Exception:
        return None
    tag = tags.get(_DATETIME_ORIGINAL)
    if not tag:
        return None
    try:
        # EXIF format: "2023:01:15 12:30:00"
        s = str(tag).strip()
        if not s or len(s) < 19:
            return None
        return datetime.strptime(s[:19], "%Y:%m:%d %H:%M:%S")
    except (ValueError, TypeError):
        return None
