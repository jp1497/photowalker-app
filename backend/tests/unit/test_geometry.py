"""Unit tests for app.utils.geometry."""
import pytest
from shapely.geometry import LineString

from app.utils.geometry import (
    distance_meters,
    validate_linestring,
    validate_route_geometry,
)


def test_validate_linestring_accepts_two_points() -> None:
    """validate_linestring returns LineString for valid coords."""
    coords = [[-122.4, 37.8], [-122.41, 37.81]]
    line = validate_linestring(coords)
    assert isinstance(line, LineString)
    assert len(line.coords) == 2


def test_validate_linestring_rejects_single_point() -> None:
    """validate_linestring raises for fewer than 2 points."""
    with pytest.raises(ValueError, match="at least 2 points"):
        validate_linestring([[-122.4, 37.8]])


def test_validate_linestring_rejects_empty() -> None:
    """validate_linestring raises for empty coords."""
    with pytest.raises(ValueError, match="at least 2 points"):
        validate_linestring([])


def test_validate_linestring_rejects_invalid_point() -> None:
    """validate_linestring raises for invalid lon/lat."""
    with pytest.raises(ValueError, match="lon must be"):
        validate_linestring([[-122.4, 37.8], [200, 37.81]])


def test_distance_meters_returns_positive() -> None:
    """distance_meters returns positive value for two distinct points."""
    line = LineString([[-122.4, 37.8], [-122.41, 37.81]])
    d = distance_meters(line)
    assert d > 0


def test_distance_meters_zero_for_duplicate_points() -> None:
    """distance_meters returns 0 when all points are the same."""
    line = LineString([[-122.4, 37.8], [-122.4, 37.8]])
    assert distance_meters(line) == 0.0


def test_validate_route_geometry_returns_line_and_distance() -> None:
    """validate_route_geometry returns (LineString, distance_meters)."""
    geom = {
        "type": "LineString",
        "coordinates": [[-122.4, 37.8], [-122.41, 37.81]],
    }
    line, dist = validate_route_geometry(geom)
    assert isinstance(line, LineString)
    assert dist > 0


def test_validate_route_geometry_rejects_distance_zero() -> None:
    """validate_route_geometry raises when distance is 0 (duplicate points)."""
    geom = {
        "type": "LineString",
        "coordinates": [[-122.4, 37.8], [-122.4, 37.8]],
    }
    with pytest.raises(ValueError, match="greater than 0"):
        validate_route_geometry(geom)


def test_validate_route_geometry_rejects_wrong_type() -> None:
    """validate_route_geometry raises when type is not LineString."""
    with pytest.raises(ValueError, match="LineString"):
        validate_route_geometry({"type": "Point", "coordinates": [-122.4, 37.8]})


def test_validate_route_geometry_rejects_single_point() -> None:
    """validate_route_geometry raises for single point."""
    geom = {"type": "LineString", "coordinates": [[-122.4, 37.8]]}
    with pytest.raises(ValueError, match="at least 2 points"):
        validate_route_geometry(geom)
