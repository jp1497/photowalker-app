"""Integration tests for photo API endpoints. Step 4.4 - Definition of Done."""
import asyncio
import os
import tempfile
from typing import Any
from uuid import uuid4

from starlette.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.factory import create_app
from app.db.session import create_engine, create_session_factory
from app.models.user import User
from app.services.auth_service import issue_tokens
from tests.conftest import requires_postgres

# Minimal JPEG (no EXIF GPS) - for 400 tests
MINIMAL_JPEG = b"\xff\xd8\xff\xd9"


async def _create_user_and_token(settings: Settings) -> tuple[User, str]:
    """Create a user in the DB and return (user, access_token)."""
    from sqlalchemy import text

    from app.db.base import Base
    uid = uuid4().hex[:8]
    engine = create_engine(settings)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(lambda c: Base.metadata.create_all(c))
    session_factory = create_session_factory(engine)
    async with session_factory() as session:
        user = User(
            google_id=f"photos-test-{uid}",
            email=f"photos-{uid}@test.com",
            name="Photos Test",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = issue_tokens(settings, user.id)[0]
    await engine.dispose()
    return user, token


def _create_user_and_token_sync(settings: Settings) -> tuple[User, str]:
    return asyncio.run(_create_user_and_token(settings))


def _photo_settings() -> Settings:
    """Settings with local storage so uploads don't need S3."""
    return Settings(
        database_url=os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
        ),
        secret_key="test-secret",
        google_client_id="test",
        google_client_secret="test",
        google_redirect_uri="http://localhost/callback",
        aws_access_key_id="your-access-key",
        aws_secret_access_key="your-secret-key",
        s3_bucket_name="test",
        local_storage_path=tempfile.mkdtemp(),
    )


def _valid_route_payload() -> dict[str, Any]:
    return {
        "title": "Photo Route",
        "description": None,
        "route_geometry": {
            "type": "LineString",
            "coordinates": [[-122.4, 37.8], [-122.41, 37.81]],
        },
        "tags": [],
        "is_public": True,
    }


@requires_postgres
def test_post_photos_with_valid_jpeg_gps_returns_201() -> None:
    """POST /v1/photos with valid JPEG + GPS (mocked) returns 201."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    upload_resp = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("photo.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"caption": "Test", "route_ids": f'["{route_id}"]'},
                    )
        assert upload_resp.status_code == 201
        data = upload_resp.json()
        assert "photo" in data
        photo = data["photo"]
        assert photo["user_id"] == str(user.id)
        assert photo["caption"] == "Test"
        assert "s3_key_original" in photo
        assert photo.get("s3_key_thumbnail") is None or photo.get("s3_key_thumbnail")
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_photos_with_jpeg_without_gps_returns_201_with_null_location() -> None:
    """POST /v1/photos with JPEG without GPS returns 201, photo with location=null (PRD v3 FR-R3)."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            upload_resp = client.post(
                "/v1/photos",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("photo.jpg", MINIMAL_JPEG, "image/jpeg")},
                data={"route_ids": f'["{route_id}"]'},
            )
        assert upload_resp.status_code == 201
        data = upload_resp.json()
        assert "photo" in data
        assert data["photo"]["location"] is None
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_post_photos_with_non_jpeg_returns_400() -> None:
    """POST /v1/photos with non-JPEG returns 400."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            upload_resp = client.post(
                "/v1/photos",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("file.png", b"not a jpeg", "image/png")},
                data={"route_ids": "[]"},
            )
        assert upload_resp.status_code == 400
        assert upload_resp.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "JPEG" in upload_resp.json()["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_routes_route_id_photos_returns_photos() -> None:
    """GET /v1/routes/{route_id}/photos returns photos."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": f'["{route_id}"]'},
                    )
            get_resp = client.get(f"/v1/routes/{route_id}/photos")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert "photos" in data
        assert len(data["photos"]) == 1
        assert data["photos"][0]["caption"] is None or data["photos"][0]["caption"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_patch_photos_enforces_ownership() -> None:
    """PATCH /v1/photos/{id} by non-owner returns 403."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token1}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token1}"},
                        files={"file": ("p.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": f'["{route_id}"]'},
                    )
            assert up.status_code == 201
            photo_id = up.json()["photo"]["id"]
            patch_resp = client.patch(
                f"/v1/photos/{photo_id}",
                headers={"Authorization": f"Bearer {token2}"},
                json={"caption": "Hacked"},
            )
        assert patch_resp.status_code == 403
        assert patch_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_patch_photos_with_location_updates_and_returns_photo() -> None:
    """PATCH /v1/photos/{id} with location updates and returns photo (PRD v3 FR-R3)."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": f'["{route_id}"]'},
                    )
            assert up.status_code == 201
            photo_id = up.json()["photo"]["id"]
            patch_resp = client.patch(
                f"/v1/photos/{photo_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"location": {"type": "Point", "coordinates": [-122.5, 37.9]}},
            )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert "photo" in data
        loc = data["photo"]["location"]
        assert loc is not None
        assert loc["type"] == "Point"
        assert loc["coordinates"] == [-122.5, 37.9]
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_patch_photos_with_invalid_location_returns_400() -> None:
    """PATCH /v1/photos/{id} with invalid location returns 400."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token}"},
                        files={"file": ("p.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": f'["{route_id}"]'},
                    )
            assert up.status_code == 201
            photo_id = up.json()["photo"]["id"]
            patch_resp = client.patch(
                f"/v1/photos/{photo_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"location": {"type": "Point", "coordinates": [200, 37.9]}},
            )
        assert patch_resp.status_code == 400
        assert patch_resp.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "longitude" in patch_resp.json()["error"]["message"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_delete_photos_enforces_ownership() -> None:
    """DELETE /v1/photos/{id} by non-owner returns 403."""
    from unittest.mock import patch
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            create_resp = client.post(
                "/v1/routes",
                headers={"Authorization": f"Bearer {token1}"},
                json=_valid_route_payload(),
            )
            assert create_resp.status_code == 201
            route_id = create_resp.json()["route"]["id"]
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token1}"},
                        files={"file": ("p.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": f'["{route_id}"]'},
                    )
            assert up.status_code == 201
            photo_id = up.json()["photo"]["id"]
            del_resp = client.delete(
                f"/v1/photos/{photo_id}",
                headers={"Authorization": f"Bearer {token2}"},
            )
        assert del_resp.status_code == 403
        assert del_resp.json()["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_settings, None)
