"""Centralized error handlers. See PRD v2 - Error Handling Middleware and Error Responses."""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


def _sanitize_validation_errors(errors: list) -> list:
    """Convert Pydantic validation errors to JSON-serializable form (ctx may contain Exception)."""
    out = []
    for e in errors:
        c = dict(e)
        if "ctx" in c and isinstance(c["ctx"], dict):
            ctx = {}
            for k, v in c["ctx"].items():
                ctx[k] = str(v) if isinstance(v, BaseException) else v
            c["ctx"] = ctx
        out.append(c)
    return out


def register_error_handlers(app: FastAPI) -> None:
    """Register exception handlers for validation, HTTP, and generic exceptions."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = _sanitize_validation_errors(exc.errors())
        first_msg = errors[0].get("msg", "") if errors else ""
        message = (
            first_msg
            if first_msg and "value_error" in str(errors[0].get("type", ""))
            else "Invalid request data"
        )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": message,
                    "details": errors,
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict):
            code = detail.get("code", "HTTP_ERROR")
            message = detail.get("message", str(detail))
            details = detail.get("details")
        else:
            code = "HTTP_ERROR"
            message = str(detail) if detail else "An error occurred"
            details = None
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                }
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred",
                    "details": None,
                }
            },
        )
