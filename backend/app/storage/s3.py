"""S3 storage client with local filesystem fallback. PRD v2 - FR3, key format photos/{user_id}/{photo_id}/original.jpg."""
from __future__ import annotations

import os
from io import BytesIO
from typing import Optional, Union
from uuid import UUID

import boto3

from app.core.config import Settings

# Placeholder values from .env.example; treat as "storage not configured" for health check
_S3_UNCONFIGURED_KEY = "your-access-key"
_S3_UNCONFIGURED_SECRET = "your-secret-key"


def _is_s3_configured(settings: Settings) -> bool:
    """Return True if S3 credentials look like real config (not placeholders)."""
    return (
        settings.aws_access_key_id != _S3_UNCONFIGURED_KEY
        and settings.aws_secret_access_key != _S3_UNCONFIGURED_SECRET
    )


def _use_local_storage(settings: Settings) -> bool:
    """Return True if we should use local filesystem instead of S3 (dev fallback)."""
    return not _is_s3_configured(settings) and bool(settings.local_storage_path)


def check_s3_connection(settings: Settings) -> None:
    """Verify S3 connectivity by running head_bucket. Raises on failure or if not configured."""
    if not _is_s3_configured(settings):
        raise ValueError("S3 not configured (using placeholder credentials)")
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    client.head_bucket(Bucket=settings.s3_bucket_name)


def _local_path(settings: Settings, key: str) -> str:
    """Resolve key to absolute path under local_storage_path."""
    base = os.path.abspath(settings.local_storage_path or "")
    return os.path.normpath(os.path.join(base, key))


def upload_file(
    settings: Settings,
    key: str,
    body: Union[bytes, BytesIO],
    content_type: Optional[str] = None,
) -> None:
    """Store file at key. Uses S3 if configured, otherwise local_storage_path (dev)."""
    if _use_local_storage(settings):
        path = _local_path(settings, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = body.getvalue() if isinstance(body, BytesIO) else body
        with open(path, "wb") as f:
            f.write(data)
        return
    if not _is_s3_configured(settings):
        raise ValueError("S3 not configured and local_storage_path not set")
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    extra = {"ContentType": content_type} if content_type else {}
    body_bytes = body.getvalue() if isinstance(body, BytesIO) else body
    client.put_object(Bucket=settings.s3_bucket_name, Key=key, Body=body_bytes, **extra)


def delete_file(settings: Settings, key: str) -> None:
    """Remove file at key. Uses S3 if configured, otherwise local filesystem."""
    if _use_local_storage(settings):
        path = _local_path(settings, key)
        if os.path.isfile(path):
            os.remove(path)
        return
    if not _is_s3_configured(settings):
        raise ValueError("S3 not configured and local_storage_path not set")
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    client.delete_object(Bucket=settings.s3_bucket_name, Key=key)


def get_presigned_url(
    settings: Settings,
    key: str,
    expiration: int = 3600,
) -> Optional[str]:
    """Return presigned GET URL for key, or None if using local storage."""
    if _use_local_storage(settings):
        return None
    if not _is_s3_configured(settings):
        return None
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expiration,
    )


def photo_original_key(user_id: UUID, photo_id: UUID, extension: str = "jpg") -> str:
    """S3 key for photo original. PRD: photos/{user_id}/{photo_id}/original.jpg."""
    return f"photos/{user_id}/{photo_id}/original.{extension}"


def photo_thumbnail_key(user_id: UUID, photo_id: UUID, extension: str = "jpg") -> str:
    """S3 key for photo thumbnail. PRD: photos/{user_id}/{photo_id}/thumbnail.jpg."""
    return f"photos/{user_id}/{photo_id}/thumbnail.{extension}"
