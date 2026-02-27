#!/usr/bin/env python3
"""Create a minimal JPEG with EXIF GPS for E2E photo upload tests only.

Output is for E2E tests only: not served to app users, not included in production build.
Run from repo root. Requires: pip install pillow piexif
"""
from __future__ import annotations

import os
import sys

# Lat 37.8, Lon -122.4 (SF area). DMS: 37 deg 48 min 0 sec N, 122 deg 24 min 0 sec W
GPS_LAT = ((37, 1), (48, 1), (0, 1))
GPS_LON = ((122, 1), (24, 1), (0, 1))

# Minimal JPEG quality that still passes backend validation (EXIF readable by exifread)
E2E_JPEG_QUALITY = 5


def main() -> None:
    try:
        from PIL import Image
        import piexif
    except ImportError as e:
        print("Need: pip install pillow piexif", file=sys.stderr)
        raise SystemExit(1) from e

    # Minimal 2x2 JPEG; smallest payload that satisfies upload (JPEG header + EXIF GPS)
    img = Image.new("RGB", (2, 2), color=(128, 128, 128))
    exif_dict = {
        "0th": {},
        "Exif": {},
        "GPS": {
            piexif.GPSIFD.GPSLatitudeRef: "N",
            piexif.GPSIFD.GPSLatitude: GPS_LAT,
            piexif.GPSIFD.GPSLongitudeRef: "W",
            piexif.GPSIFD.GPSLongitude: GPS_LON,
        },
        "1st": {},
        "thumbnail": None,
    }
    exif_bytes = piexif.dump(exif_dict)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "e2e", "fixtures")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "photo-with-gps.jpg")
    img.save(out_path, "JPEG", exif=exif_bytes, quality=E2E_JPEG_QUALITY)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
