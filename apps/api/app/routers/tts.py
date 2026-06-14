# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Thin controller for Qwen3-TTS endpoints. Handles HTTP in/out only —
# delegates all logic to tts_service.
#
# ENDPOINTS:
#   POST /api/tts/generate → TTS with saved voice + full param injection
#   POST /api/tts/clone    → Clone via Qwen3-TTS + full param injection
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.schemas.tts import (
    TTSGenerateRequest,
    TTSCloneRequest,
    QWEN3_TTS_LANGUAGES,
)
from app.services import clone_service
from app.services import tts_service
from app.middleware import limiter

logger = logging.getLogger("tarang.tts")

router = APIRouter(prefix="/api/tts", tags=["tts"])


# ── TTS Generate (saved voice) ──────────────────────────────────────────────

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_tts(
    request: Request,
    body: TTSGenerateRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate speech from text using a saved voice from the library.

    Supports full parameter injection: temperature, top_p, top_k,
    max_new_tokens, speed, guidance_scale, and NL instruction.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        voice_uuid = uuid.UUID(request.voice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid voice ID")

    try:
        result = await tts_service.generate_tts(
            db=db,
            user_id=user_id,
            text=body.text,
            voice_id=voice_uuid,
            language=body.language,
            instruction=body.instruction,
            params=body.params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="TTS generation failed")

    return result


# ── Clone via Qwen3-TTS ─────────────────────────────────────────────────────

@router.post("/clone")
@limiter.limit("10/minute")
async def clone_tts(
    request: Request,
    body: TTSCloneRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a voice using Qwen3-TTS with raw reference audio.

    Send base64-encoded reference audio + text + full params.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        result = await tts_service.generate_clone(
            db=db,
            user_id=user_id,
            text=body.text,
            ref_audio_b64=body.ref_audio_b64,
            language=body.language,
            instruction=body.instruction,
            params=body.params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("TTS clone failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="TTS clone failed")

    return result


# ── Supported languages ─────────────────────────────────────────────────────

@router.get("/languages")
async def get_supported_languages():
    """Return the 10 languages supported by Qwen3-TTS."""
    return {"languages": QWEN3_TTS_LANGUAGES}
