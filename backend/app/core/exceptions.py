"""Application exceptions for API layer to map to HTTP responses."""


class RouteNotFoundError(Exception):
    """Route not found by id or slug."""


class RouteForbiddenError(Exception):
    """User is not allowed to perform action on this route (e.g. not owner)."""


class PhotoNotFoundError(Exception):
    """Photo not found by id."""


class PhotoForbiddenError(Exception):
    """User is not allowed to perform action on this photo (e.g. not owner)."""


class BboxTooLargeError(Exception):
    """Requested bounding box area exceeds the maximum allowed (50 km²)."""
