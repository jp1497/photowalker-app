"""Unit tests for app.schemas.photo."""
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.photo import PhotoResponse, PhotoUpdate


def test_photo_response_excludes_internal_fields() -> None:
    """PhotoResponse does not expose internal fields such as exif_data."""
    assert "exif_data" not in PhotoResponse.model_fields


def test_photo_response_serialization_omits_exif_data() -> None:
    """When validating from object with exif_data, serialized output does not include it."""
    uid = uuid4()
    pid = uuid4()
    # Simulate ORM object with internal field
    class MockPhoto:
        id = pid
        user_id = uid
        caption = "Cap"
        location = {"type": "Point", "coordinates": [-122.0, 37.0]}
        s3_key_original = "photos/u/p/original.jpg"
        s3_key_thumbnail = "photos/u/p/thumbnail.jpg"
        file_size_bytes = 1024
        captured_at = None
        created_at = datetime.now(timezone.utc)
        updated_at = datetime.now(timezone.utc)
        exif_data = {"internal": "should not appear"}

    resp = PhotoResponse.model_validate(MockPhoto())
    dumped = resp.model_dump()
    assert "exif_data" not in dumped
    assert dumped["user_id"] == uid
    assert dumped["file_size_bytes"] == 1024


def test_photo_update_caption_and_route_ids() -> None:
    """PhotoUpdate accepts optional caption and route_ids."""
    r1 = uuid4()
    r2 = uuid4()
    payload = PhotoUpdate(caption="New cap", route_ids=[r1, r2])
    assert payload.caption == "New cap"
    assert payload.route_ids == [r1, r2]


def test_photo_update_all_optional() -> None:
    """PhotoUpdate allows all None."""
    payload = PhotoUpdate()
    assert payload.caption is None
    assert payload.route_ids is None
