"""Typed domain exceptions for Tarang API.

Per backend/10-error-handling.md, each layer uses typed exceptions:
  Repository → throws low-level errors
  Service    → catches and re-throws as typed domain errors
  Controller → maps domain errors to HTTP status codes

These exceptions carry NO HTTP awareness — status code mapping
happens only in routers (controllers).
"""


class TarangError(Exception):
    """Base exception for all Tarang domain errors."""

    def __init__(self, message: str = "An error occurred"):
        self.message = message
        super().__init__(self.message)


class NotFoundError(TarangError):
    """Raised when a requested resource does not exist.

    Maps to: HTTP 404 in the controller layer.
    """

    def __init__(self, resource: str = "Resource", identifier: str = ""):
        detail = f"{resource} not found"
        if identifier:
            detail = f"{resource} '{identifier}' not found"
        super().__init__(detail)


class ConflictError(TarangError):
    """Raised when an action conflicts with current state.

    Examples: duplicate voice_id, job already processing.
    Maps to: HTTP 409 in the controller layer.
    """
    pass


class DomainError(TarangError):
    """Raised when a business rule is violated.

    Examples: insufficient credits, file too large, unsupported format.
    Maps to: HTTP 422 in the controller layer.
    """
    pass


class ExternalServiceError(TarangError):
    """Raised when an external API call fails.

    Examples: Replicate timeout, R2 upload failure.
    Maps to: HTTP 502/504 in the controller layer.
    """

    def __init__(self, service: str, message: str = ""):
        detail = f"{service} service error"
        if message:
            detail = f"{service}: {message}"
        super().__init__(detail)
        self.service = service
