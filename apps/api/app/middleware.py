# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Centralizes all middleware registration for the FastAPI app.
# Per 05-architecture.md §5: CORS → Rate Limiting → Security Headers → Routes.
#
# MIDDLEWARE STACK (execution order):
#   1. CORS — handles preflight and cross-origin headers
#   2. Security Headers — injects X-Frame-Options, CSP, HSTS, etc.
#   3. Shared Secret — verifies X-Tarang-Secret header (Cloud Run protection)
#   4. Rate Limiting — per-IP global throttle (per-route limits in routers)
# ─────────────────────────────────────────────────────────────────────────────

import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

logger = logging.getLogger("tarang.middleware")

# ── Real Client IP Extraction ────────────────────────────────────────────────
# WHY: With Cloudflare proxy (orange cloud) in front of api.trytarang.app,
# request.client.host is Cloudflare's edge IP — NOT the visitor's real IP.
# Cloudflare sends the real visitor IP in the CF-Connecting-IP header.
# Falls back to X-Forwarded-For → raw socket IP for local dev / non-CF envs.

def get_real_ip(request: Request) -> str:
    """Extract the real client IP, accounting for Cloudflare proxy.

    Priority:
      1. CF-Connecting-IP  — set by Cloudflare on every proxied request
      2. X-Forwarded-For   — first IP in the chain (fallback for non-CF proxies)
      3. request.client.host — raw TCP socket IP (local dev, no proxy)
    """
    # Cloudflare always sets this to the true visitor IP
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    # Standard proxy header — take the first (leftmost = original client) IP
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # No proxy — local development
    return request.client.host if request.client else "127.0.0.1"


# ── Rate Limiter (shared instance — import in routers for per-route limits) ──
# Uses in-memory storage by default. Acceptable for single-worker Cloud Run.
# For multi-instance production, switch to Redis: storage_uri=settings.REDIS_URL
limiter = Limiter(key_func=get_real_ip, default_limits=["100/minute"])


# ── Per-user rate limiting key function ──────────────────────────────────────
# WHY: Per-IP alone doesn't stop one authenticated user from bursting 500
# parallel requests before credit deduction catches up (race condition).
# This ties rate limits to Clerk user ID when available.

def get_user_or_ip(request: Request) -> str:
    """Rate limit key: use Clerk user ID if authenticated, fall back to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.removeprefix("Bearer ").strip()
        try:
            from app.utils.auth import verify_clerk_token
            payload = verify_clerk_token(token)
            user_id = payload.get("sub", "")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass
    return get_real_ip(request)


# ── Shared Secret Middleware ─────────────────────────────────────────────────
# Per deployment plan: protects the *.run.app URL from unauthorized access.
# Only Vercel server routes and Clerk webhooks should be calling Cloud Run.

class SharedSecretMiddleware(BaseHTTPMiddleware):
    """Verify X-Tarang-Secret header on non-public routes.

    Protects the Cloud Run URL from scrapers and bots.
    Clerk JWT remains the real auth layer — this is a speed bump.
    """

    # Routes that skip shared secret check (health probes + webhooks)
    PUBLIC_PATHS = frozenset({
        "/health",
        "/health/deep",
        "/api/webhooks",
        "/api/webhooks/",
        "/api/webhooks/clerk",
        "/api/feedback",
        "/api/feedback/",
    })

    async def dispatch(self, request: Request, call_next) -> Response:
        expected = settings.CLOUD_RUN_SHARED_SECRET
        if not expected:
            # No secret configured = dev mode, skip check
            return await call_next(request)

        # Health checks and webhooks skip secret check
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # OPTIONS preflight requests skip auth (CORS handles these)
        if request.method == "OPTIONS":
            return await call_next(request)

        actual = request.headers.get("X-Tarang-Secret", "")
        if actual != expected:
            logger.warning(
                "🚫 Rejected request without valid shared secret: %s %s",
                request.method,
                request.url.path,
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden"},
            )

        return await call_next(request)


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
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Tarang-Secret"],
        
    )

    # 2. Security Headers
    app.add_middleware(SecurityHeadersMiddleware) 

    # 3. Shared Secret (Cloud Run URL protection)
    app.add_middleware(SharedSecretMiddleware)

    # 4. Rate Limiting (slowapi)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
