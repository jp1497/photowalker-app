"""Application exceptions for API layer to map to HTTP responses."""


class RouteNotFoundError(Exception):
    """Route not found by id or slug."""


class RouteForbiddenError(Exception):
    """User is not allowed to perform action on this route (e.g. not owner)."""
