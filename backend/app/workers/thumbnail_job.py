"""RQ job: generate thumbnail for photo. PRD v2 - FR3, Step 4.3."""
from __future__ import annotations

import logging
from uuid import UUID

from rq import Queue
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.models.photo import Photo
from app.storage.s3 import get_file_content, photo_thumbnail_key, upload_file
from app.utils.thumbnail import resize_to_thumbnail

logger = logging.getLogger(__name__)

# Queue name for thumbnail jobs
QUEUE_NAME = "thumbnails"


def enqueue_thumbnail_job(photo_id: UUID, settings: Settings) -> None:
    """Enqueue thumbnail generation job. No-op if redis_url not configured."""
    if not settings.redis_url:
        logger.debug("enqueue_thumbnail_job: redis_url not set, skipping")
        return
    try:
        from redis import Redis
        redis_conn = Redis.from_url(settings.redis_url)
        queue = Queue(QUEUE_NAME, connection=redis_conn)
        queue.enqueue(generate_thumbnail, str(photo_id), job_timeout="5m")
    except Exception as e:
        logger.exception("enqueue_thumbnail_job: failed to enqueue photo_id=%s: %s", photo_id, e)


def generate_thumbnail(photo_id: str) -> None:
    """Download original from storage, resize to max 800px width, upload thumbnail, update photo record.

    Called by RQ worker. photo_id is UUID string. Logs errors; RQ can retry on failure.
    """
    try:
        pid = UUID(photo_id)
    except (ValueError, TypeError):
        logger.exception("generate_thumbnail: invalid photo_id=%s", photo_id)
        raise
    settings = get_settings()
    sync_url = settings.sync_database_url
    engine = create_engine(sync_url, pool_pre_ping=True, pool_size=1)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = session_factory()
    try:
        photo = session.get(Photo, pid)
        if not photo:
            logger.warning("generate_thumbnail: photo not found id=%s", photo_id)
            return
        if photo.s3_key_thumbnail:
            logger.info("generate_thumbnail: already has thumbnail id=%s", photo_id)
            return
        try:
            original_bytes = get_file_content(settings, photo.s3_key_original)
        except Exception as e:
            logger.exception("generate_thumbnail: failed to download original id=%s: %s", photo_id, e)
            raise
        try:
            thumb_bytes = resize_to_thumbnail(original_bytes)
        except Exception as e:
            logger.exception("generate_thumbnail: resize failed id=%s: %s", photo_id, e)
            raise
        key_thumb = photo_thumbnail_key(photo.user_id, photo.id)
        try:
            upload_file(settings, key_thumb, thumb_bytes, content_type="image/jpeg")
        except Exception as e:
            logger.exception("generate_thumbnail: upload thumbnail failed id=%s: %s", photo_id, e)
            raise
        photo.s3_key_thumbnail = key_thumb
        session.commit()
        logger.info("generate_thumbnail: done id=%s", photo_id)
    finally:
        session.close()
        engine.dispose()
