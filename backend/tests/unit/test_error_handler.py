"""Unit tests for app.middleware.error_handler."""
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.middleware.error_handler import register_error_handlers


def test_validation_error_returns_400_with_correct_format() -> None:
    """RequestValidationError returns 400 and error body with code VALIDATION_ERROR."""
    app = FastAPI()
    register_error_handlers(app)

    @app.post("/test")
    async def body_endpoint(body: dict) -> dict:
        return body

    client = TestClient(app)
    response = client.post("/test", content="not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert data["error"]["message"] == "Invalid request data"
    assert "details" in data["error"]


def test_http_exception_returns_correct_status_and_format() -> None:
    """HTTPException returns the given status and error format."""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/notfound")
    async def notfound() -> None:
        raise HTTPException(status_code=404, detail="Resource not found")

    client = TestClient(app)
    response = client.get("/notfound")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "HTTP_ERROR"
    assert "Resource not found" in data["error"]["message"]


def test_http_exception_with_dict_detail() -> None:
    """HTTPException with dict detail uses code and message from detail."""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/custom")
    async def custom() -> None:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Not allowed", "details": {"id": "123"}},
        )

    client = TestClient(app)
    response = client.get("/custom")
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "FORBIDDEN"
    assert data["error"]["message"] == "Not allowed"
    assert data["error"]["details"] == {"id": "123"}
