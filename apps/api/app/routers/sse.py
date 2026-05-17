# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Server-Sent Events (SSE) endpoint for real-time clone job progress.
# Replaces the frontend's setTimeout-based polling with a push-based stream.
#
# HOW IT WORKS:
#   Client opens EventSource to /api/voices/{job_id}/stream?token=<JWT>
#   → Backend opens an async generator that reads CloneJob from DB every 1.5s
#   → Sends SSE events with {status, clone_stage, stage_message, output_url}
#   → Auto-closes on terminal states (succeeded/failed) or 5-min timeout
#
# WHY SSE over WebSockets:
#   - SSE is simpler (unidirectional, built-in reconnection)
#   - Clone progress is one-way (server → client)
#   - No need for bidirectional communication
#   - EventSource has native browser support with auto-reconnect
#
# CROSS-REQUEST SAFETY:
#   Each SSE connection is isolated per job_id. Opening the history page
#   (GET /api/history) while an SSE stream is active for cloning will NOT
#   interfere — they're completely independent HTTP connections.
#
# AUTH:
#   EventSource doesn't support custom headers, so auth token is passed
#   as a query parameter (?token=<JWT>). This is validated the same way
#   as the Authorization header.
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.utils.auth import verify_clerk_token
from app.models.clone_job import CloneJob, CloneJobStatus
from app.services.clone_service import STAGE_MESSAGES, resolve_user_id
from app.services.storage import get_download_presigned_url

logger = logging.getLogger("tarang.sse")

router = APIRouter(prefix="/api/sse", tags=["sse"])

# How often to check DB for updates (seconds)
POLL_INTERVAL = 1.5
# Maximum stream duration before auto-close (seconds)
MAX_STREAM_DURATION = 300  # 5 minutes


async def _stream_clone_status(
    job_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """Async generator that yields SSE events for a clone job.

    Reads the CloneJob from DB periodically and yields status updates.
    Closes automatically on terminal states or timeout.
    """
    elapsed = 0.0
    last_stage = None

    while elapsed < MAX_STREAM_DURATION:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(CloneJob).where(
                        CloneJob.id == job_id,
                        CloneJob.user_id == user_id,
                    )
                )
                job = result.scalar_one_or_none()

            if not job:
                # Job not found — send error and close
                data = json.dumps({"error": "Clone job not found"})
                yield f"event: error\ndata: {data}\n\n"
                return

            stage = job.clone_stage or ""
            status_value = (
                job.status.value if hasattr(job.status, "value") else str(job.status)
            )

            # Build event payload
            payload = {
                "status": status_value,
                "clone_stage": stage,
                "stage_message": STAGE_MESSAGES.get(stage, ""),
                "error_message": job.error_message,
                "output_url": None,
            }

            if job.status == CloneJobStatus.succeeded and job.output_r2_key:
                payload["output_url"] = get_download_presigned_url(job.output_r2_key)

            # Only send if stage changed (or first event)
            if stage != last_stage or elapsed == 0.0:
                data = json.dumps(payload)
                yield f"data: {data}\n\n"
                last_stage = stage

            # Terminal state — send final event and close
            if job.status in (CloneJobStatus.succeeded, CloneJobStatus.failed):
                return

        except Exception as exc:
            logger.warning("SSE stream error for job %s: %s", job_id, exc)
            data = json.dumps({"error": "Internal error reading job status"})
            yield f"event: error\ndata: {data}\n\n"
            return

        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    # Timeout
    data = json.dumps({"error": "Stream timed out", "status": "timeout"})
    yield f"event: error\ndata: {data}\n\n"


@router.get("/{job_id}/stream")
async def stream_clone_status(
    job_id: str,
    token: str = Query(..., description="Clerk JWT for auth"),
):
    """SSE endpoint for real-time clone job progress.

    Auth via query param because EventSource doesn't support custom headers.
    """
    # Validate token manually (can't use Depends for query-param auth)
    try:
        payload = verify_clerk_token(token)
        clerk_user_id = payload.get("sub")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing user identity")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    # Resolve user
    async with AsyncSessionLocal() as db:
        try:
            user_id = await resolve_user_id(db, clerk_user_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="User not found")

    return StreamingResponse(
        _stream_clone_status(job_uuid, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
