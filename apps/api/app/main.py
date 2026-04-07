import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.database import async_engine
from app.models import Base
from app.middleware import setup_middlewares
from app.routers import health, history, voices, webhooks

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tarang")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (will switch to Alembic later)."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created/verified")
    yield


app = FastAPI(
    title="Tarang API",
    description="AI-powered voice cloning backend",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Middleware ──
setup_middlewares(app)

# ── Routers ──
app.include_router(health.router)
app.include_router(history.router)
app.include_router(webhooks.router)
app.include_router(voices.router)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)