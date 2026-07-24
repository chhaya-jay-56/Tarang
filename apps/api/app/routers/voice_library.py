# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Thin controller for voice library endpoints. Handles HTTP in/out only —
# delegates all logic to voice_library_service.
#
# ENDPOINTS:
#   POST   /api/voice-library          → create voice (multipart upload)
#   POST   /api/voice-library/from-clone → save from completed clone job
#   GET    /api/voice-library          → list user's voices + presets
#   DELETE /api/voice-library/{id}     → delete a saved voice
#   GET    /api/voice-library/{id}/audio → presigned audio URL
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.schemas.voice_library import SaveVoiceFromCloneRequest
from app.services import clone_service
from app.services import voice_library_service
from app.services.storage import get_download_presigned_url

logger = logging.getLogger("tarang.voice_library")

router = APIRouter(prefix="/api/voice-library", tags=["voice-library"])


# ── Create voice (upload reference audio) ────────────────────────────────────

@router.post("", status_code=201)
async def create_voice(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(None),
    language: str = Form("en"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new voice by uploading reference audio.

    Accepts multipart form: name, description, language, audio file.
    Returns 201 Created with voice metadata.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    file_bytes = await file.read()

    try:
        voice = await voice_library_service.create_voice(
            db=db,
            user_id=user_id,
            name=name,
            file_bytes=file_bytes,
            filename=file.filename or "voice.wav",
            language=language,
            description=description,
        )
    except Exception as exc:
        logger.error("Voice creation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create voice")

    audio_url = get_download_presigned_url(voice.r2_key)

    return {
        "id": str(voice.id),
        "name": voice.name,
        "description": voice.description,
        "voice_type": "custom",
        "language": voice.language,
        "duration_ms": voice.duration_ms,
        "is_preset": False,
        "r2_key": voice.r2_key,
        "audio_url": audio_url,
        "created_at": voice.created_at.isoformat() if voice.created_at else None,
    }


# ── Save voice from clone job ────────────────────────────────────────────────

@router.post("/from-clone", status_code=201)
async def save_from_clone(
    request: SaveVoiceFromCloneRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a completed clone job's output as a reusable voice."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        job_uuid = uuid.UUID(request.job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    try:
        voice = await voice_library_service.save_voice_from_clone(
            db=db,
            user_id=user_id,
            job_id=job_uuid,
            name=request.name,
            language=request.language,
            description=request.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    audio_url = get_download_presigned_url(voice.r2_key)

    return {
        "id": str(voice.id),
        "name": voice.name,
        "voice_type": voice.voice_type.value,
        "language": voice.language,
        "duration_ms": voice.duration_ms,
        "audio_url": audio_url,
        "created_at": voice.created_at.isoformat() if voice.created_at else None,
    }


# ── List voices ──────────────────────────────────────────────────────────────

@router.get("")
async def list_voices(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all voices — user's custom voices + platform presets."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    voices = await voice_library_service.list_user_voices(db, user_id)

    return {
        "voices": [
            {
                **v,
                "audio_url": get_download_presigned_url(v["r2_key"]),
                "created_at": v["created_at"].isoformat() if v.get("created_at") else None,
            }
            for v in voices
        ],
        "total": len(voices),
    }


# ── Delete voice ─────────────────────────────────────────────────────────────

@router.delete("/{voice_id}", status_code=204)
async def delete_voice(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom voice. Preset voices cannot be deleted."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        voice_uuid = uuid.UUID(voice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid voice ID")

    try:
        await voice_library_service.delete_saved_voice(db, voice_uuid, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return Response(status_code=204)


# ── Get voice audio URL ─────────────────────────────────────────────────────

@router.get("/{voice_id}/audio")
async def get_voice_audio(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a presigned URL for the voice's reference audio."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        voice_uuid = uuid.UUID(voice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid voice ID")

    try:
        data = await voice_library_service.get_voice_audio_url(db, voice_uuid, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return data

