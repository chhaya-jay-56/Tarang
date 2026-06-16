# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Centralizes all middleware registration for the FastAPI app.
# Per 05-architecture.md §5: CORS → Rate Limiting → Security Headers → Routes.
#
# MIDDLEWARE STACK (execution order):
#   1. CORS — handles preflight and cross-origin headers
#   2. Security Headers — injects X-Frame-Options, CSP, HSTS, etc.
#   3. Rate Limiting — per-IP global throttle (per-route limits in routers)
# ─────────────────────────────────────────────────────────────────────────────

import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

logger = logging.getLogger("tarang.middleware")

# ── Rate Limiter (shared instance — import in routers for per-route limits) ──
# Uses in-memory storage by default. For multi-worker production,
# switch to Redis: Limiter(key_func=..., storage_uri=settings.REDIS_URL)
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


# ── Security Headers Middleware ──────────────────────────────────────────────
# Per 13-security.md §8: inject security headers on every response.

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects standard security headers on every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'"
        )
        return response


def setup_middlewares(app: FastAPI):
    """Register all middleware in correct order."""

    # 1. CORS (must be first — handles preflight requests)
    # Per 13-security.md §7: restrict methods/headers to what the app uses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOWED_ORIGINS,
        allow_origin_regex=r"https://[a-zA-Z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.app)",
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )

    # 2. Security Headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Rate Limiting (slowapi)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
