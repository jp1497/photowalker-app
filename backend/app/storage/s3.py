"""S3 storage utilities. Minimal connectivity check for health endpoint."""
from __future__ import annotations

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
