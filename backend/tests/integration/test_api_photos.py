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


# --- GET /v1/photos (photos-in-bbox). PRD v6 - Step 0.1 ---


@requires_postgres
def test_get_v1_photos_with_bbox_returns_photos_and_pagination() -> None:
    """GET /v1/photos?bbox=... returns photos in bbox with pagination. No auth required."""
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
                        data={"caption": "Bbox photo", "route_ids": f'["{route_id}"]'},
                    )
            assert upload_resp.status_code == 201
            response = client.get(
                "/v1/photos?bbox=-122.42,37.78,-122.38,37.84"
            )
        assert response.status_code == 200
        data = response.json()
        assert "photos" in data
        assert "pagination" in data
        pagination = data["pagination"]
        assert pagination["page"] == 1
        assert pagination["per_page"] == 20
        assert pagination["total"] >= 1
        photos = data["photos"]
        assert len(photos) >= 1
        photo = next((p for p in photos if p.get("caption") == "Bbox photo"), photos[0])
        assert "id" in photo
        assert "caption" in photo
        assert "user" in photo
        assert photo["user"]["id"] == str(user.id)
        assert photo["user"]["name"] == user.name
        assert "route_ids" in photo
        assert str(route_id) in photo["route_ids"]
        assert "routes" in photo
        assert isinstance(photo["routes"], list)
        assert len(photo["routes"]) >= 1
        assert photo["routes"][0]["slug"]
        assert photo["image_url"] == f"/v1/photos/{photo['id']}/image"
        assert "location" in photo
        assert photo["location"]["type"] == "Point"
        assert len(photo["location"]["coordinates"]) == 2
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_bbox_too_large_returns_400() -> None:
    """GET /v1/photos?bbox=... with area > 200 km² returns 400."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.get("/v1/photos?bbox=-122.5,37.0,-121.5,38.0")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "200 km²" in response.json()["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_invalid_bbox_returns_400() -> None:
    """GET /v1/photos with invalid bbox returns 400."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.get("/v1/photos?bbox=invalid")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_missing_bbox_returns_400() -> None:
    """GET /v1/photos without bbox returns 400 (validation: required query param)."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as client:
            response = client.get("/v1/photos")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_my_returns_only_current_user_photos_in_bbox() -> None:
    """GET /v1/photos/my?bbox=... returns only the authenticated user's photos in bbox."""
    from unittest.mock import patch

    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user1, token1 = _create_user_and_token_sync(settings)
        user2, token2 = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            with patch("app.services.photo_service.extract_gps", return_value=(37.8, -122.4)):
                with patch("app.services.photo_service.extract_captured_at", return_value=None):
                    up1 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token1}"},
                        files={"file": ("p1.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
                    up2 = client.post(
                        "/v1/photos",
                        headers={"Authorization": f"Bearer {token2}"},
                        files={"file": ("p2.jpg", MINIMAL_JPEG, "image/jpeg")},
                        data={"route_ids": "[]"},
                    )
            assert up1.status_code == 201
            assert up2.status_code == 201
            photo1_id = up1.json()["photo"]["id"]
            photo2_id = up2.json()["photo"]["id"]

            resp = client.get(
                "/v1/photos/my?bbox=-122.42,37.78,-122.38,37.84",
                headers={"Authorization": f"Bearer {token1}"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "photos" in data
        photos = data["photos"]
        assert len(photos) >= 1
        ids = {p["id"] for p in photos}
        assert photo1_id in ids
        assert photo2_id not in ids
        assert all(p["user"]["id"] == str(user1.id) for p in photos)
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_my_bbox_too_large_returns_400() -> None:
    """GET /v1/photos/my?bbox=... with area > 200 km² returns 400."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            resp = client.get(
                "/v1/photos/my?bbox=-122.5,37.0,-121.5,38.0",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 400
        body = resp.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "200 km²" in body["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


@requires_postgres
def test_get_v1_photos_my_invalid_or_missing_bbox_returns_400() -> None:
    """GET /v1/photos/my with invalid or missing bbox returns 400."""
    settings = _photo_settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        user, token = _create_user_and_token_sync(settings)
        with TestClient(app) as client:
            resp_invalid = client.get(
                "/v1/photos/my?bbox=invalid",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp_missing = client.get(
                "/v1/photos/my",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp_invalid.status_code == 400
        assert resp_invalid.json()["error"]["code"] == "VALIDATION_ERROR"
        # Missing bbox is a validation error on the query param as well
        assert resp_missing.status_code == 400
        assert resp_missing.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_settings, None)
