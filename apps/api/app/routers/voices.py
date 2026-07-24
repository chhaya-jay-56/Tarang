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
#   - Accepts language in clone request body (100+ OmniVoice languages)
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
    Request,
    UploadFile,
)
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.schemas.voice import CloneRequest
from app.services import clone_service
from app.models.preset_voice import PresetVoice
from app.models.custom_voice import CustomVoice
from app.models.user_asset import UserAsset, AssetType
from app.services.credit_service import (
    check_credit_sufficient,
    estimate_clone_credits,
)
from app.config import settings
from app.middleware import limiter, get_user_or_ip
from sqlalchemy import select

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
    # ── Validate content type (first-pass filter) ──
    if file.content_type and not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected audio file, got {file.content_type}",
        )

    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    file_bytes = await file.read()

    # ── Enforce server-side size limit ──
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes) / 1024 / 1024:.1f}MB). "
                   f"Max is {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

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
@limiter.limit("10/minute", key_func=get_user_or_ip)
async def trigger_clone(
    asset_id: str,
    body: CloneRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a voice cloning job. Returns immediately for polling.

    Accepts a UserAsset ID, CustomVoice ID, or PresetVoice ID.
    Creates a proxy UserAsset with a UNIQUE r2_key per clone request
    to avoid UNIQUE constraint collisions on user_assets.r2_key.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset ID")

    # We will do the exact credit check AFTER resolving the voice source.

    # ── Resolve the voice source ──
    # Priority: UserAsset (direct) → CustomVoice (user) → PresetVoice (platform)
    voice_r2_key = None
    voice_name = ""
    voice_duration_ms = None
    # cached_voice_id: UUID string for custom voices with cached .pt prompts
    # For presets, we use the voice name; for custom, we use the UUID.
    cached_voice_id = ""

    # 1. Check if it's a direct UserAsset
    asset_result = await db.execute(
        select(UserAsset).where(UserAsset.id == asset_uuid, UserAsset.user_id == user_id)
    )
    existing_asset = asset_result.scalar_one_or_none()

    if existing_asset:
        # Direct UserAsset — use as-is (no proxy needed)
        # voice_name and cached_voice_id stay empty so the Modal worker
        # always processes from the raw reference audio (no caching).
        asset_uuid = existing_asset.id
        voice_name = ""
        cached_voice_id = ""
    else:
        # 2. Check CustomVoice (user's own voices)
        cv_result = await db.execute(
            select(CustomVoice).where(
                CustomVoice.id == asset_uuid,
                CustomVoice.user_id == user_id,
            )
        )
        custom_voice = cv_result.scalar_one_or_none()

        if custom_voice:
            voice_r2_key = custom_voice.r2_key
            voice_name = custom_voice.name
            voice_duration_ms = custom_voice.duration_ms
            # Use the UUID as cached_voice — maps to /preset-voices/custom/{id}.pt
            cached_voice_id = str(custom_voice.id)
        else:
            # 3. Check PresetVoice (platform voices)
            pv_result = await db.execute(
                select(PresetVoice).where(PresetVoice.id == asset_uuid)
            )
            preset_voice = pv_result.scalar_one_or_none()

            if preset_voice:
                voice_r2_key = preset_voice.r2_key
                voice_name = preset_voice.name
                voice_duration_ms = preset_voice.duration_ms
            else:
                raise HTTPException(status_code=404, detail="Voice asset not found")

        # Create a proxy UserAsset with a UNIQUE r2_key per clone request.
        # WHY unique per request: The old code reused the voice's r2_key,
        # which hit the UNIQUE constraint on user_assets.r2_key on the 2nd
        # clone attempt. Now each proxy gets its own key — no collisions.
        proxy_asset_id = uuid.uuid4()
        proxy_r2_key = f"voices/proxy/{user_id}/{proxy_asset_id}.ref"
        proxy_asset = UserAsset(
            id=proxy_asset_id,
            user_id=user_id,
            asset_type=AssetType.voice_sample,
            r2_key=proxy_r2_key,
            file_name=voice_name + ".wav",
            duration_ms=voice_duration_ms,
        )
        db.add(proxy_asset)
        await db.commit()
        asset_uuid = proxy_asset_id

    # ✅ CREDIT GATE — check exact required credits based on voice type
    is_custom_voice = (cached_voice_id != "") or existing_asset is not None
    exact_cost = estimate_clone_credits(body.text, is_custom=is_custom_voice)
    try:
        await check_credit_sufficient(db, user_id, exact_cost)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    try:
        job = await clone_service.create_clone_job(
            db=db,
            voice_asset_id=asset_uuid,
            user_id=user_id,
            text=body.text,
            target_language=body.resolved_target_language,
            voice_r2_key=voice_r2_key,
            speed=body.speed,
            voice_name=voice_name,
            cached_voice_id=cached_voice_id,
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
