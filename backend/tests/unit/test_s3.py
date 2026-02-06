"""Unit tests for app.storage.s3 (upload, delete, local fallback)."""
import os
import tempfile
from uuid import uuid4

from app.core.config import Settings
from app.storage.s3 import (
    delete_file,
    photo_original_key,
    photo_thumbnail_key,
    upload_file,
)


def _local_storage_settings(dir_path: str) -> Settings:
    """Settings with S3 placeholders and local_storage_path set (use local FS)."""
    return Settings(
        database_url="postgresql+asyncpg://localhost/db",
        secret_key="k",
        google_client_id="c",
        google_client_secret="s",
        google_redirect_uri="http://localhost/cb",
        aws_access_key_id="your-access-key",
        aws_secret_access_key="your-secret-key",
        s3_bucket_name="bucket",
        local_storage_path=dir_path,
    )


def test_upload_stores_file() -> None:
    """upload_file with local storage stores file at key path."""
    with tempfile.TemporaryDirectory() as tmp:
        settings = _local_storage_settings(tmp)
        key = "photos/uid/pid/original.jpg"
        body = b"fake-jpeg-content"
        upload_file(settings, key, body)
        path = os.path.join(tmp, key)
        assert os.path.isfile(path)
        with open(path, "rb") as f:
            assert f.read() == body


def test_upload_accepts_bytes_io() -> None:
    """upload_file accepts BytesIO body."""
    from io import BytesIO
    with tempfile.TemporaryDirectory() as tmp:
        settings = _local_storage_settings(tmp)
        key = "photos/a/b/thumb.jpg"
        upload_file(settings, key, BytesIO(b"thumb-data"))
        path = os.path.join(tmp, key)
        assert os.path.isfile(path)
        with open(path, "rb") as f:
            assert f.read() == b"thumb-data"


def test_delete_removes_file() -> None:
    """delete_file with local storage removes file."""
    with tempfile.TemporaryDirectory() as tmp:
        settings = _local_storage_settings(tmp)
        key = "photos/u/p/original.jpg"
        path = os.path.join(tmp, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(b"x")
        assert os.path.isfile(path)
        delete_file(settings, key)
        assert not os.path.isfile(path)


def test_delete_idempotent_when_file_missing() -> None:
    """delete_file does not raise when file already missing (local storage)."""
    with tempfile.TemporaryDirectory() as tmp:
        settings = _local_storage_settings(tmp)
        delete_file(settings, "photos/nonexistent/photo/original.jpg")


def test_photo_original_key_format() -> None:
    """photo_original_key produces PRD format photos/{user_id}/{photo_id}/original.jpg."""
    uid = uuid4()
    pid = uuid4()
    assert photo_original_key(uid, pid) == f"photos/{uid}/{pid}/original.jpg"
    assert photo_original_key(uid, pid, "jpeg") == f"photos/{uid}/{pid}/original.jpeg"


def test_photo_thumbnail_key_format() -> None:
    """photo_thumbnail_key produces PRD format photos/{user_id}/{photo_id}/thumbnail.jpg."""
    uid = uuid4()
    pid = uuid4()
    assert photo_thumbnail_key(uid, pid) == f"photos/{uid}/{pid}/thumbnail.jpg"
