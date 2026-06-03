# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# FastAPI application entry point — creates the app, attaches middleware
# and routers. This file should ONLY handle layout and routing (no heavy
# logic per user rules).
#
# KEY CHANGE: Removed Base.metadata.create_all()
#   The old version auto-created tables on startup. This is dangerous in
#   production because:
#   - It can't handle column changes (only creates, never alters)
#   - It races with other app instances in multi-worker setups
#   - It provides no rollback capability
#   Alembic now manages the schema. Run: `alembic upgrade head`
#
# FLOW: uvicorn → loads this file → creates FastAPI app → registers
#   middleware + routers → serves requests
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.middleware import setup_middlewares

# Voices router migrated to new models (UserAsset + CloneJob + Modal OmniVoice)
from app.routers import health, webhooks, voices, history, sse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tarang")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle.

    IMPORTANT: Schema is now managed by Alembic, NOT by create_all().
    Run `alembic upgrade head` before starting the server.
    """
    logger.info("🚀 Tarang API starting — schema managed by Alembic")
    yield
    logger.info("👋 Tarang API shutting down")


app = FastAPI(
    title="Tarang API",
    description="AI-powered voice cloning & video dubbing backend",
    version="0.3.0",
    lifespan=lifespan,
)

# ── Middleware ──
setup_middlewares(app)

# ── Routers ──
app.include_router(health.router)
app.include_router(webhooks.router)
app.include_router(voices.router)
app.include_router(history.router)
app.include_router(sse.router)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)