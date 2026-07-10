# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Test endpoint for the Demucs voice separation service.
# Allows uploading audio → triggering separation → downloading stems.
# This is NOT part of the dubbing pipeline — it's a standalone test
# endpoint so we can verify separation works before wiring Phase 2.
#
# CONCEPT: Controller Layer (from standards/05-architecture.md §2)
#   - Thin HTTP layer: parse request, call service, format response.
#   - No business logic here — that lives in demucs_service.py.
#
# FLOW:
#   Client → POST /separation/separate → upload to R2 → call Modal → return R2 keys
#   Client → GET /separation/{job_id}/download/{stem} → presigned URL
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uuid
import io

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.history import History
from app.services import clone_service
from app.services.credit_service import (
    check_and_deduct,
    estimate_separation_credits,
    refund_credits,
)
from app.services.demucs_service import separate_audio, DemucsError
from app.services.storage import upload_file, get_download_presigned_url
from app.middleware import limiter, get_user_or_ip

logger = logging.getLogger("tarang.separation_router")

router = APIRouter(
    prefix="/api/v1/separation",
    tags=["separation"],
)


def _estimate_audio_duration_seconds(file_bytes: bytes, filename: str | None) -> float | None:
    """Best-effort audio duration detection for separation credit estimates."""
    import wave

    try:
        with wave.open(io.BytesIO(file_bytes), "rb") as wf:
            rate = wf.getframerate()
            if rate > 0:
                return wf.getnframes() / rate
    except Exception:
        pass

    try:
        from pydub import AudioSegment

        ext = ""
        if filename and "." in filename:
            ext = filename.rsplit(".", 1)[1].lower()
        audio = AudioSegment.from_file(io.BytesIO(file_bytes), format=ext or None)
        return len(audio) / 1000.0
    except Exception:
        return None


async def _charge_separation(
    db: AsyncSession,
    user_id: uuid.UUID,
    file_bytes: bytes,
    filename: str | None,
) -> tuple[int, float | None]:
    duration_seconds = _estimate_audio_duration_seconds(file_bytes, filename)
    estimated_seconds = duration_seconds if duration_seconds and duration_seconds > 0 else 180.0
    credit_cost = estimate_separation_credits(estimated_seconds)
    await check_and_deduct(
        db,
        user_id,
        credit_cost,
        f"voice_separation:{filename or 'audio'}",
    )
    await db.commit()
    return credit_cost, duration_seconds


async def _refund_separation(
    db: AsyncSession,
    user_id: uuid.UUID,
    credit_cost: int,
    reason: str,
) -> None:
    try:
        await refund_credits(db, user_id, credit_cost, reason)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("[separation] Failed to refund credits: %s", exc, exc_info=True)


@router.post("/separate")
@limiter.limit("10/minute", key_func=get_user_or_ip)
async def trigger_separation(
    request: Request,
    file: UploadFile = File(..., description="Audio file (WAV) to separate"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an audio file and trigger Demucs voice separation.

    1. Validates file is audio
    2. Uploads to R2 as temporary input
    3. Calls Modal Demucs for separation
    4. Returns R2 keys for vocals + instrumental

    This is a synchronous endpoint — it waits for Modal to finish
    (up to 10 minutes). For production pipeline use, this would
    be an async Celery task instead.
    """
    # ── Validate file type ──
    if file.content_type and not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected audio file, got {file.content_type}",
        )

    # ── Read file bytes ──
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        credit_cost, duration_seconds = await _charge_separation(
            db, user_id, file_bytes, file.filename
        )
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    # ── Generate job ID and upload to R2 ──
    job_id = str(uuid.uuid4())
    import os
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".wav"
    if not ext:
        ext = ".wav"
    input_r2_key = f"dub/{job_id}/full_audio{ext}"

    try:
        upload_file(file_bytes, input_r2_key)
        logger.info("[separation] Uploaded %s (%d bytes)", input_r2_key, len(file_bytes))
    except Exception as exc:
        logger.error("[separation] R2 upload failed: %s", exc)
        await _refund_separation(db, user_id, credit_cost, "separation_refund:r2_upload")
        raise HTTPException(status_code=500, detail="Failed to upload audio to storage")

    # ── Call Demucs Modal service ──
    try:
        result = await separate_audio(
            audio_r2_key=input_r2_key,
            job_id=job_id,
        )
    except DemucsError as exc:
        await _refund_separation(db, user_id, credit_cost, "separation_refund:modal_error")
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        await _refund_separation(db, user_id, credit_cost, "separation_refund:configuration")
        raise HTTPException(status_code=503, detail=str(exc))

    db.add(History(
        user_id=user_id,
        action="separation_completed",
        metadata_={
            "filename": file.filename,
            "duration_seconds": duration_seconds,
            "credits_used": credit_cost,
            "job_id": job_id,
        },
    ))
    await db.commit()

    return {
        "job_id": job_id,
        "status": "completed",
        "vocal_r2_key": result["vocal_r2_key"],
        "instrumental_r2_key": result["instrumental_r2_key"],
        "vocals_size_bytes": result.get("vocals_size_bytes"),
        "instrumental_size_bytes": result.get("instrumental_size_bytes"),
        "sample_rate": result.get("sample_rate"),
        "credits_used": credit_cost,
    }


@router.get("/{job_id}/download/{stem}")
async def download_stem(
    job_id: str,
    stem: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a presigned download URL for a separated audio stem.

    Args:
        job_id: The separation job ID (returned from POST /separate)
        stem: Either "vocals" or "instrumental"
    """
    if stem not in ("vocals", "instrumental"):
        raise HTTPException(
            status_code=400,
            detail="stem must be 'vocals' or 'instrumental'",
        )

    # ── Ownership verification (per 13-security.md §6) ──
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    from sqlalchemy import select
    result = await db.execute(
        select(History).where(
            History.user_id == user_id,
            History.action == "separation_completed",
            History.metadata_["job_id"].as_string() == job_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=404,
            detail=f"Separation job {job_id} not found",
        )

    r2_key = f"dub/{job_id}/{stem}.wav"

    try:
        download_url = get_download_presigned_url(r2_key, expiration=3600)
    except Exception as exc:
        logger.error("[separation] Failed to generate presigned URL: %s", exc)
        raise HTTPException(
            status_code=404,
            detail=f"Stem '{stem}' not found for job {job_id}",
        )

    return {
        "download_url": download_url,
        "stem": stem,
        "filename": f"{stem}.wav",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Direct Separation Endpoint (standalone Voice Separation product)
# ─────────────────────────────────────────────────────────────────────────────
# WHY A SEPARATE ENDPOINT:
#   The /separate endpoint above is for the dubbing pipeline (returns R2 keys).
#   This endpoint is for the standalone product: upload audio → get download URLs.
#   Files are temporary — presigned URLs expire in 1 hour.

@router.post("/separate-direct")
@limiter.limit("10/minute", key_func=get_user_or_ip)
async def separate_direct(
    request: Request,
    file: UploadFile = File(..., description="Audio file to separate into stems"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload audio → Demucs separation → return presigned download URLs.

    This is the standalone voice separation product endpoint.
    Returns presigned URLs for vocals.wav and instrumental.wav.
    Files are NOT persisted — user must download immediately.
    """
    # ── Validate file type ──
    if file.content_type and not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected audio file, got {file.content_type}",
        )

    # ── Read + validate size ──
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    max_size = 50 * 1024 * 1024  # 50 MB
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes) / 1024 / 1024:.1f}MB). Max is 50MB.",
        )

    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        credit_cost, duration_seconds = await _charge_separation(
            db, user_id, file_bytes, file.filename
        )
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    # ── Generate job ID + upload to R2 ──
    job_id = str(uuid.uuid4())
    import os
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".wav"
    if not ext:
        ext = ".wav"
    input_r2_key = f"dub/{job_id}/full_audio{ext}"

    try:
        upload_file(file_bytes, input_r2_key)
        logger.info(
            "[separation-direct] Uploaded %s (%d bytes, original: %s)",
            input_r2_key,
            len(file_bytes),
            file.filename,
        )
    except Exception as exc:
        logger.error("[separation-direct] R2 upload failed: %s", exc)
        await _refund_separation(db, user_id, credit_cost, "separation_refund:r2_upload")
        raise HTTPException(status_code=500, detail="Failed to upload audio to storage")

    # ── Call Demucs Modal ──
    try:
        result = await separate_audio(
            audio_r2_key=input_r2_key,
            job_id=job_id,
        )
    except DemucsError as exc:
        await _refund_separation(db, user_id, credit_cost, "separation_refund:modal_error")
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        await _refund_separation(db, user_id, credit_cost, "separation_refund:configuration")
        raise HTTPException(status_code=503, detail=str(exc))

    # ── Generate presigned download URLs (1-hour expiry) ──
    vocals_r2_key = result["vocal_r2_key"]
    instrumental_r2_key = result["instrumental_r2_key"]

    try:
        vocals_url = get_download_presigned_url(vocals_r2_key, expiration=3600)
        instrumental_url = get_download_presigned_url(instrumental_r2_key, expiration=3600)
    except Exception as exc:
        logger.error("[separation-direct] Failed to generate download URLs: %s", exc)
        await _refund_separation(db, user_id, credit_cost, "separation_refund:url_generation")
        raise HTTPException(status_code=500, detail="Separation succeeded but download URL generation failed")

    logger.info("[separation-direct] ✅ Job %s complete — URLs generated", job_id)

    db.add(History(
        user_id=user_id,
        action="separation_completed",
        metadata_={
            "filename": file.filename,
            "duration_seconds": duration_seconds,
            "credits_used": credit_cost,
            "job_id": job_id,
        },
    ))
    await db.commit()

    return {
        "job_id": job_id,
        "status": "completed",
        "vocals_url": vocals_url,
        "instrumental_url": instrumental_url,
        "vocals_size_bytes": result.get("vocals_size_bytes"),
        "instrumental_size_bytes": result.get("instrumental_size_bytes"),
        "sample_rate": result.get("sample_rate"),
        "credits_used": credit_cost,
    }
