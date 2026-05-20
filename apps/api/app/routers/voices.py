# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Thin controller layer for voice cloning endpoints — per 05-architecture.md.
# Handles HTTP in/out ONLY: extracts params, delegates to clone_service,
# chooses HTTP status code, sends response.
#
# MIGRATED FROM: Replicate + IndexTTS-2 + old Voice model
# MIGRATED TO:   Modal + OmniVoice + UserAsset + CloneJob models
#
# KEY CHANGES:
#   - No more Voice model → uses UserAsset (file) + CloneJob (job state)
#   - No more Replicate API → Modal OmniVoice endpoint
#   - No more clerk_user_id on models → resolves to User.id (UUID)
#   - Accepts language in clone request body (646 OmniVoice languages)
#   - Proper status codes: 201 on create, 204 on delete (per 06-rest-api.md)
#
# FLOW:
#   HTTP Request → voices router → clone_service → storage + DB + Modal
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.schemas.voice import CloneRequest
from app.services import clone_service

logger = logging.getLogger("tarang.voices")

router = APIRouter(prefix="/api/voices", tags=["voices"])


# ── Upload voice sample ─────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_voice(
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a voice sample WAV file. Creates a UserAsset record.

    Returns 201 Created with asset metadata.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    file_bytes = await file.read()

    try:
        asset = await clone_service.upload_voice_sample(
            db=db,
            file_bytes=file_bytes,
            filename=file.filename or "voice.wav",
            user_id=user_id,
        )
    except Exception as exc:
        logger.error("Upload failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload voice sample")

    return {
        "asset_id": str(asset.id),
        "status": "uploaded",
        "r2_key": asset.r2_key,
        "file_size": asset.file_size,
        "duration_ms": asset.duration_ms,
    }


# ── Trigger voice clone ─────────────────────────────────────────────────────

@router.post("/{asset_id}/clone", status_code=201)
async def trigger_clone(
    asset_id: str,
    request: CloneRequest,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a voice cloning job. Returns immediately for polling.

    Returns 201 Created with job_id. Frontend polls /status for progress.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset ID")

    try:
        job = await clone_service.create_clone_job(
            db=db,
            voice_asset_id=asset_uuid,
            user_id=user_id,
            text=request.text,
            target_language=request.resolved_target_language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Enqueue background pipeline
    background_tasks.add_task(clone_service.run_clone_pipeline, job.id)

    return {
        "status": "processing",
        "job_id": str(job.id),
        "voice_id": str(job.id),  # Backward compat with frontend
    }


# ── Poll clone status ───────────────────────────────────────────────────────

@router.get("/{job_id}/status")
async def get_clone_status(
    job_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll cloning job status with granular progress info."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    try:
        status_data = await clone_service.get_clone_status(db, job_uuid, user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Clone job not found")

    return status_data


# ── Download cloned audio ───────────────────────────────────────────────────

@router.get("/{job_id}/download")
async def download_cloned_voice(
    job_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a presigned R2 download URL for the cloned audio."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    try:
        download_data = await clone_service.get_clone_download(db, job_uuid, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return download_data


# ── List voice assets ────────────────────────────────────────────────────────

@router.get("")
async def list_voices(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all voice sample assets belonging to the authenticated user.

    Returns 200 OK with asset list (200 + [] for empty list per 06-rest-api.md).
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    assets = await clone_service.list_voice_assets(db, user_id)
    return {
        "assets": [
            {
                "id": str(a.id),
                "asset_type": a.asset_type.value,
                "file_name": a.file_name,
                "file_size": a.file_size,
                "duration_ms": a.duration_ms,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in assets
        ],
        "total": len(assets),
    }


# ── Delete voice asset ──────────────────────────────────────────────────────

@router.delete("/{asset_id}", status_code=204)
async def delete_voice(
    asset_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a voice asset and its files from R2.

    Returns 204 No Content on success (per 06-rest-api.md).
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset ID")

    try:
        await clone_service.delete_voice_asset(db, asset_uuid, user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Voice asset not found")

    return Response(status_code=204)
