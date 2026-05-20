# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Business logic layer for voice cloning — per 05-architecture.md.
# Completely decoupled from HTTP (no request/response objects, no status codes).
# Called by the voices router (controller layer).
#
# CONCEPT: Service Layer (from standards/05-architecture.md §3)
#   - Receives clean validated data in, returns plain data out.
#   - Orchestrates: R2 storage, DB writes, Modal API calls.
#   - This is what you unit test most heavily.
#
# PROVIDER: Modal (OmniVoice)
#   The clone pipeline POSTs base64-encoded WAV + text + language
#   to the Modal clone_api endpoint. Modal returns WAV bytes directly.
#
# FLOW:
#   Router → clone_service → storage + DB + Modal
# ─────────────────────────────────────────────────────────────────────────────

import base64
import io
import logging
import uuid
import wave

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.clone_job import CloneJob, CloneJobStatus
from app.models.history import History
from app.models.user import User
from app.models.user_asset import AssetType, UserAsset
from app.services.storage import (
    delete_file,
    get_download_presigned_url,
    upload_file,
)

logger = logging.getLogger("tarang.clone_service")


# ── Stage messages for frontend progress UI ──────────────────────────────────

STAGE_MESSAGES = {
    "queued": "Starting clone...",
    "downloading_reference": "Preparing reference audio...",
    "uploading_to_ai": "Sending to OmniVoice...",
    "model_loading": "Loading AI model...",
    "model_running": "Cloning your voice...",
    "downloading_output": "Processing output...",
    "saving_to_storage": "Saving cloned audio...",
    "completed": "Clone complete!",
    "failed": "Clone failed.",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_wav_duration_ms(file_bytes: bytes) -> int | None:
    """Extract duration in milliseconds from WAV file bytes."""
    try:
        buf = io.BytesIO(file_bytes)
        with wave.open(buf, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return int((frames / rate) * 1000)
    except Exception:
        pass
    return None


async def resolve_user_id(db: AsyncSession, clerk_user_id: str) -> uuid.UUID:
    """Look up User by clerk_user_id → return UUID user_id.

    WHY: New models FK to users.id (UUID), but auth middleware returns
    clerk_user_id (string). This bridges the gap.

    Raises ValueError if user not found.
    """
    result = await db.execute(
        select(User.id).where(User.clerk_user_id == clerk_user_id)
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise ValueError(f"User not found for clerk_user_id: {clerk_user_id}")
    return user_id


# ── Upload voice sample ─────────────────────────────────────────────────────

async def upload_voice_sample(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
) -> UserAsset:
    """Upload WAV to R2 and create a UserAsset record.

    Returns the created UserAsset. Logs a History entry.
    """
    asset_id = uuid.uuid4()
    r2_key = f"voices/raw/{user_id}/{asset_id}.wav"

    # Upload to R2
    upload_file(file_bytes, r2_key)

    # Compute duration
    duration_ms = _get_wav_duration_ms(file_bytes)

    # Create asset record
    asset = UserAsset(
        id=asset_id,
        user_id=user_id,
        asset_type=AssetType.voice_sample,
        r2_key=r2_key,
        file_name=filename,
        file_size=len(file_bytes),
        duration_ms=duration_ms,
    )
    db.add(asset)

    # Log history
    db.add(History(
        user_id=user_id,
        action="uploaded",
        metadata_={
            "filename": filename,
            "size_bytes": len(file_bytes),
            "duration_ms": duration_ms,
            "asset_id": str(asset_id),
        },
    ))

    await db.commit()
    await db.refresh(asset)
    return asset


# ── Create clone job ─────────────────────────────────────────────────────────

async def create_clone_job(
    db: AsyncSession,
    voice_asset_id: uuid.UUID,
    user_id: uuid.UUID,
    text: str,
    target_language: str = "",
) -> CloneJob:
    """Create a queued CloneJob and log History. Returns the new CloneJob."""
    # Verify asset exists and belongs to user
    result = await db.execute(
        select(UserAsset).where(
            UserAsset.id == voice_asset_id,
            UserAsset.user_id == user_id,
        )
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise ValueError("Voice asset not found or not owned by user")

    job_id = uuid.uuid4()
    job = CloneJob(
        id=job_id,
        user_id=user_id,
        voice_asset_id=voice_asset_id,
        input_text=text,
        target_language=target_language or None,
        provider="modal",
        model_name="omnivoice",
        status=CloneJobStatus.queued,
        clone_stage="queued",
        provider_meta={
            "endpoint": settings.MODAL_CLONE_ENDPOINT,
        },
    )
    db.add(job)

    # Log history
    db.add(History(
        user_id=user_id,
        clone_job_id=job_id,
        action="clone_started",
        metadata_={
            "text": text[:200],  # Truncate for storage
            "target_language": target_language,
            "provider": "modal",
            "model": "omnivoice",
        },
    ))

    await db.commit()
    await db.refresh(job)
    return job


# ── Get clone status ─────────────────────────────────────────────────────────

async def get_clone_status(
    db: AsyncSession,
    job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Read CloneJob by ID with user ownership check. Returns status dict."""
    result = await db.execute(
        select(CloneJob).where(
            CloneJob.id == job_id,
            CloneJob.user_id == user_id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise ValueError("Clone job not found")

    stage = job.clone_stage or ""
    stage_message = STAGE_MESSAGES.get(stage, "")

    response = {
        "status": job.status.value if hasattr(job.status, "value") else str(job.status),
        "clone_stage": stage,
        "stage_message": stage_message,
        "error_message": job.error_message,
        "output_url": None,
    }

    if job.status == CloneJobStatus.succeeded and job.output_r2_key:
        response["output_url"] = get_download_presigned_url(job.output_r2_key)

    return response


# ── List voice assets ────────────────────────────────────────────────────────

async def list_voice_assets(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[UserAsset]:
    """List all voice_sample assets for a user."""
    result = await db.execute(
        select(UserAsset).where(
            UserAsset.user_id == user_id,
            UserAsset.asset_type == AssetType.voice_sample,
        ).order_by(UserAsset.created_at.desc())
    )
    return list(result.scalars().all())


# ── Delete voice asset ───────────────────────────────────────────────────────

async def delete_voice_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Delete a voice asset from R2 and DB."""
    result = await db.execute(
        select(UserAsset).where(
            UserAsset.id == asset_id,
            UserAsset.user_id == user_id,
        )
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise ValueError("Voice asset not found")

    # Delete from R2
    try:
        delete_file(asset.r2_key)
    except Exception as exc:
        logger.warning("Failed to delete R2 file %s: %s", asset.r2_key, exc)

    await db.delete(asset)
    await db.commit()


# ── Get download URL ─────────────────────────────────────────────────────────

async def get_clone_download(
    db: AsyncSession,
    job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Generate a presigned R2 download URL for cloned audio."""
    result = await db.execute(
        select(CloneJob).where(
            CloneJob.id == job_id,
            CloneJob.user_id == user_id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise ValueError("Clone job not found")
    if not job.output_r2_key:
        raise ValueError("No cloned audio available yet")

    download_url = get_download_presigned_url(job.output_r2_key)
    return {
        "download_url": download_url,
        "filename": f"cloned_{str(job.id)[:8]}.wav",
    }


# ── Background clone pipeline ────────────────────────────────────────────────

def _download_from_r2(r2_key: str) -> bytes:
    """Download object bytes from R2 using boto3 (sync)."""
    from app.services.storage import get_r2_client
    s3 = get_r2_client()
    resp = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    return resp["Body"].read()


async def _set_stage(db: AsyncSession, job: CloneJob, stage: str):
    """Update clone_stage and commit — each stage is visible to polling clients."""
    job.clone_stage = stage
    await db.commit()
    logger.info("[clone] stage → %s", stage)


async def _fail_clone(
    db: AsyncSession,
    job: CloneJob,
    user_message: str,
    raw_error: str = "",
):
    """Mark job as failed with a user-facing error message."""
    job.status = CloneJobStatus.failed
    job.clone_stage = "failed"
    job.error_message = user_message
    db.add(History(
        user_id=job.user_id,
        clone_job_id=job.id,
        action="clone_failed",
        metadata_={"error": raw_error or user_message},
    ))
    await db.commit()
    logger.error("[clone] FAILED: %s | raw: %s", user_message, raw_error)


async def run_clone_pipeline(job_id: uuid.UUID):
    """Background clone pipeline — downloads ref, calls Modal, saves output.

    Uses its own DB session since the request session is closed by the time
    this background task runs.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CloneJob).where(CloneJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        if not job:
            logger.error("[clone] job %s vanished before pipeline started", job_id)
            return

        # Get the voice asset R2 key
        asset_result = await db.execute(
            select(UserAsset.r2_key).where(UserAsset.id == job.voice_asset_id)
        )
        r2_key = asset_result.scalar_one_or_none()
        if not r2_key:
            await _fail_clone(db, job, "Reference voice asset not found")
            return

        try:
            # ── Stage 1: Mark as processing ──
            job.status = CloneJobStatus.processing
            await _set_stage(db, job, "downloading_reference")

            # ── Stage 2: Download reference audio from R2 ──
            try:
                ref_bytes = _download_from_r2(r2_key)
            except Exception as exc:
                await _fail_clone(
                    db, job,
                    "Failed to retrieve your reference audio from storage",
                    str(exc),
                )
                return

            # ── Stage 3: Send to Modal OmniVoice ──
            await _set_stage(db, job, "uploading_to_ai")

            ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")
            modal_payload = {
                "text": job.input_text,
                "ref_audio_b64": ref_b64,
            }
            if job.target_language:
                modal_payload["language"] = job.target_language

            await _set_stage(db, job, "model_loading")

            async with httpx.AsyncClient(timeout=300) as client:
                try:
                    await _set_stage(db, job, "model_running")
                    resp = await client.post(
                        settings.MODAL_CLONE_ENDPOINT,
                        json=modal_payload,
                    )
                    if resp.status_code != 200:
                        error_text = resp.text[:500]
                        await _fail_clone(
                            db, job,
                            f"AI model returned error (HTTP {resp.status_code})",
                            error_text,
                        )
                        return

                    cloned_bytes = resp.content
                except httpx.TimeoutException:
                    await _fail_clone(
                        db, job,
                        "AI model took too long to respond. Please try again.",
                        "timeout",
                    )
                    return
                except Exception as exc:
                    await _fail_clone(
                        db, job,
                        "Failed to communicate with AI service",
                        str(exc),
                    )
                    return

            # ── Stage 4: Save cloned audio to R2 ──
            await _set_stage(db, job, "saving_to_storage")
            cloned_r2_key = f"voices/cloned/{job.user_id}/{job.id}.wav"
            try:
                upload_file(cloned_bytes, cloned_r2_key)
            except Exception as exc:
                await _fail_clone(
                    db, job,
                    "Failed to save cloned audio to storage",
                    str(exc),
                )
                return

            # ── Stage 5: Mark as completed ──
            cloned_duration_ms = _get_wav_duration_ms(cloned_bytes)
            job.status = CloneJobStatus.succeeded
            job.clone_stage = "completed"
            job.output_r2_key = cloned_r2_key
            job.output_duration_ms = cloned_duration_ms
            job.error_message = None

            db.add(History(
                user_id=job.user_id,
                clone_job_id=job.id,
                action="clone_completed",
                metadata_={
                    "text": job.input_text[:200],
                    "provider": "modal",
                    "model": "omnivoice",
                    "target_language": job.target_language,
                    "cloned_size_bytes": len(cloned_bytes),
                    "cloned_duration_ms": cloned_duration_ms,
                },
            ))
            await db.commit()
            logger.info("[clone] ✅ clone complete for job %s", job_id)

        except Exception as exc:
            logger.error("[clone] unexpected error: %s", exc, exc_info=True)
            await _fail_clone(
                db, job,
                f"Unexpected error during cloning: {exc}",
                str(exc),
            )
