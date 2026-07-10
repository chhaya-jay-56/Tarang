# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Provides health check endpoints for Railway/monitoring.
#
# ENDPOINTS:
#   GET /health      → shallow liveness probe (fast, no deps)
#   GET /health/deep → deep readiness probe (tests DB + R2 connectivity)
#
# Per 10-error-handling.md §3: production health checks should verify
# all critical dependencies, not just return a static response.
# ─────────────────────────────────────────────────────────────────────────────

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db

logger = logging.getLogger("tarang.health")

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Shallow liveness probe — used by Cloud Run / load balancers.

    Returns 503 during graceful shutdown so the LB stops routing
    new traffic before connection draining begins.
    Per 12-graceful-shutdown.md §4.
    """
    from app.main import get_shutdown_flag
    if get_shutdown_flag():
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "shutting_down", "service": "tarang-backend"},
        )
    return {"status": "ok", "service": "tarang-backend"}


@router.get("/health/deep")
async def deep_health_check(db: AsyncSession = Depends(get_db)):
    """Deep readiness probe — tests DB and R2 connectivity.

    Use this for monitoring dashboards and pre-deploy verification.
    Returns individual component status so failures are diagnosable.
    """
    checks = {}

    # ── Database ──
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.error("Health check: DB failed: %s", exc)
        checks["database"] = "error"

    # ── R2 Storage ──
    try:
        from app.services.storage import get_r2_client
        from app.config import settings

        s3 = get_r2_client()
        s3.head_bucket(Bucket=settings.R2_BUCKET_NAME)
        checks["r2_storage"] = "ok"
    except Exception as exc:
        logger.error("Health check: R2 failed: %s", exc)
        checks["r2_storage"] = "error"

    all_ok = all(v == "ok" for v in checks.values())
    status_code = 200 if all_ok else 503

    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if all_ok else "degraded",
            "service": "tarang-backend",
            "checks": checks,
        },
    )
