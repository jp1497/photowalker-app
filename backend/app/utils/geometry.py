"""Geometry validation and distance calculation for routes. WGS84, LineString. See PRD v2."""
from __future__ import annotations

from typing import Any

from pyproj import Geod
from shapely.geometry import LineString

# WGS84
GEOD = Geod(ellps="WGS84")

MIN_POINTS = 2


def validate_linestring(coordinates: list[list[float]]) -> LineString:
    """Validate GeoJSON LineString coordinates and return a Shapely LineString.

    - At least 2 points required.
    - Each point is [lon, lat] (WGS84).
    - Raises ValueError if invalid.
    """
    if len(coordinates) < MIN_POINTS:
        raise ValueError(f"LineString must have at least {MIN_POINTS} points")
    for i, pt in enumerate(coordinates):
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            raise ValueError(f"Point {i} must be [lon, lat]")
        lon, lat = float(pt[0]), float(pt[1])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError(f"Point {i}: lon must be in [-180,180], lat in [-90,90]")
    line = LineString(coordinates)
    if line.is_empty:
        raise ValueError("Invalid LineString geometry")
    return line


def distance_meters(line: LineString) -> float:
    """Compute geodesic length of a LineString in meters (WGS84)."""
    if line.is_empty or len(line.coords) < 2:
        return 0.0
    coords = list(line.coords)
    total = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i][0], coords[i][1]
        lon2, lat2 = coords[i + 1][0], coords[i + 1][1]
        _, _, dist = GEOD.inv(lon1, lat1, lon2, lat2)
        total += abs(dist)
    return total


def validate_route_geometry(geometry: dict[str, Any]) -> tuple[LineString, float]:
    """Validate route_geometry GeoJSON dict; return (LineString, distance_meters).

    Expects {"type": "LineString", "coordinates": [[lon, lat], ...]}.
    Raises ValueError if invalid. Distance must be > 0.
    """
    if not isinstance(geometry, dict):
        raise ValueError("route_geometry must be an object")
    if geometry.get("type") != "LineString":
        raise ValueError("route_geometry type must be LineString")
    coords = geometry.get("coordinates")
    if not isinstance(coords, list):
        raise ValueError("route_geometry must have coordinates array")
    line = validate_linestring(coords)
    dist = distance_meters(line)
    if dist <= 0:
        raise ValueError("Route distance must be greater than 0")
    return line, dist
