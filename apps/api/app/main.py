import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware import setup_middlewares
from app.exceptions import (
    TarangError,
    NotFoundError,
    ConflictError,
    DomainError,
    ExternalServiceError,
)

# Voices router migrated to new models (UserAsset + CloneJob + Modal OmniVoice)
from app.routers import health, webhooks, voices, history, separation, voice_library, tts, credits

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tarang")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle.

    IMPORTANT: Schema is now managed by Alembic, NOT by create_all().
    Run `alembic upgrade head` before starting the server.
    """
    missing_settings = settings.validate_for_runtime()
    if missing_settings and settings.is_strict_env:
        raise RuntimeError(
            "Missing required production settings: " + ", ".join(missing_settings)
        )
    if missing_settings:
        logger.warning(
            "Tarang API starting with missing optional/dev settings: %s",
            ", ".join(missing_settings),
        )

    logger.info("🚀 Tarang API starting — schema managed by Alembic")
    yield
    # Gracefully close all pooled asyncpg connections to avoid
    # CancelledError / TimeoutError on shutdown.
    from app.database import async_engine
    await async_engine.dispose()
    logger.info("👋 Tarang API shutting down")


app = FastAPI(
    title="Tarang API",
    description="AI-powered voice cloning backend",
    version="0.4.0",
    lifespan=lifespan,
)

# ── Middleware ──
setup_middlewares(app)


# ── Global Error Handlers ──
# Per 10-error-handling.md §5: every backend must have a global error handler.
# Maps typed domain exceptions to safe HTTP responses. Unhandled exceptions
# return a generic 500 — never leak internal details to the client.

@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": exc.message})


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(status_code=422, content={"detail": exc.message})


@app.exception_handler(ExternalServiceError)
async def external_service_handler(request: Request, exc: ExternalServiceError):
    return JSONResponse(status_code=502, content={"detail": exc.message})


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Routers ──
app.include_router(health.router)
app.include_router(webhooks.router)
app.include_router(voices.router)
app.include_router(history.router)
app.include_router(separation.router)
app.include_router(voice_library.router)
app.include_router(tts.router)
app.include_router(credits.router)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

