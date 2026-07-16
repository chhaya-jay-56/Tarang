# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Business logic for Qwen3-TTS generation. Calls the Modal-hosted
# Qwen3-TTS model with full parameter injection.
#
# Three modes supported by the model:
#   1. TTS     — text + saved voice reference → wav
#   2. Clone   — text + raw ref audio → wav
#   3. PVC     — source audio + ref audio → wav (endpoint ready, UI deferred)
#
# FLOW:
#   Router → tts_service → Modal endpoint → R2 storage
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
from app.models.preset_voice import PresetVoice
from app.models.custom_voice import CustomVoice
from app.models.history import History
from app.services.storage import (
    upload_file,
    get_download_presigned_url,
)
from app.services.credit_service import (
    estimate_tts_credits,
    check_and_deduct,
    check_credit_sufficient,
    refund_credits,
)

logger = logging.getLogger("tarang.tts_service")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_wav_duration_ms(file_bytes: bytes) -> int | None:
    """Extract duration from WAV file bytes."""
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


def _download_from_r2(r2_key: str) -> bytes:
    """Download object bytes from R2 (sync)."""
    from app.services.storage import get_r2_client
    s3 = get_r2_client()
    resp = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    return resp["Body"].read()


def _build_params_dict(params) -> dict:
    """Convert TTSParams pydantic model to dict for Modal payload."""
    return {
        "temperature": params.temperature,
        "top_p": params.top_p,
        "top_k": params.top_k,
        "max_new_tokens": params.max_new_tokens,
        "speed": params.speed,
        "guidance_scale": params.guidance_scale,
    }


async def _resolve_voice(
    db: AsyncSession,
    voice_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CustomVoice | PresetVoice:
    """Look up a voice from CustomVoice (user-scoped) or PresetVoice (platform).

    Returns the matching voice object. Raises ValueError if not found.
    """
    # Try custom voice first (user's own)
    cv_result = await db.execute(
        select(CustomVoice).where(
            CustomVoice.id == voice_id,
            CustomVoice.user_id == user_id,
        )
    )
    voice = cv_result.scalar_one_or_none()
    if voice:
        return voice

    # Try preset voice (platform-wide)
    pv_result = await db.execute(
        select(PresetVoice).where(PresetVoice.id == voice_id)
    )
    voice = pv_result.scalar_one_or_none()
    if voice:
        return voice

    raise ValueError("Voice not found")


# ── TTS Generate (saved voice) ──────────────────────────────────────────────

async def generate_tts(
    db: AsyncSession,
    user_id: uuid.UUID,
    text: str,
    voice_id: uuid.UUID,
    language: str = "en",
    instruction: str = "",
    params=None,
) -> dict:
    """Generate speech using a saved voice from the library.

    Downloads the voice's reference audio from R2 and sends to Modal.
    Returns dict with audio_url, duration_ms, r2_key.
    """
    # ✅ CREDIT GATE — check BEFORE voice resolution (DB + R2 work)
    credit_cost = estimate_tts_credits(text)
    await check_credit_sufficient(db, user_id, credit_cost)

    # Fetch the voice (custom or preset)
    voice = await _resolve_voice(db, voice_id, user_id)

    # ── Atomic credit deduction (pre-charge based on text length) ──
    try:
        await check_and_deduct(db, user_id, credit_cost, f"tts_generate:{text[:50]}", service_type="tts")
    except ValueError as exc:
        raise ValueError(str(exc))

    # Download reference audio from R2
    try:
        ref_bytes = _download_from_r2(voice.r2_key)
    except Exception as exc:
        # Refund on failure before GPU processing
        await refund_credits(db, user_id, credit_cost, "tts_generate_refund:ref_download_fail")
        await db.commit()
        raise ValueError(f"Failed to fetch voice reference audio: {exc}")

    ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")

    # Build Modal payload
    payload = {
        "mode": "tts",
        "text": text,
        "ref_audio_b64": ref_b64,
        "language": language,
        "instruction": instruction,
    }
    if params:
        payload["params"] = _build_params_dict(params)

    # Call Modal endpoint
    endpoint_prefix = settings.MODAL_QWEN3_TTS_ENDPOINT
    if not endpoint_prefix:
        await refund_credits(db, user_id, credit_cost, "tts_generate_refund:no_endpoint")
        await db.commit()
        raise ValueError("MODAL_QWEN3_TTS_ENDPOINT not configured")
    
    # Modal URL format: prefix-tts-api.modal.run
    url = f"{endpoint_prefix}-tts-api.modal.run"

    headers = {}
    if settings.MODAL_SHARED_SECRET:
        headers["x-tarang-modal-secret"] = settings.MODAL_SHARED_SECRET

    async with httpx.AsyncClient(timeout=300) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                await refund_credits(db, user_id, credit_cost, "tts_generate_refund:modal_error")
                await db.commit()
                raise ValueError(
                    f"Qwen3-TTS returned error (HTTP {resp.status_code}): "
                    f"{resp.text[:500]}"
                )
            audio_bytes = resp.content
        except httpx.TimeoutException:
            await refund_credits(db, user_id, credit_cost, "tts_generate_refund:timeout")
            await db.commit()
            raise ValueError("Qwen3-TTS took too long to respond")

    # Save output to R2
    gen_id = uuid.uuid4()
    r2_key = f"tts/output/{user_id}/{gen_id}.wav"
    try:
        upload_file(audio_bytes, r2_key)
    except Exception as exc:
        await refund_credits(db, user_id, credit_cost, "tts_generate_refund:r2_upload")
        await db.commit()
        raise ValueError(f"Failed to save generated audio: {exc}")

    duration_ms = _get_wav_duration_ms(audio_bytes)
    audio_url = get_download_presigned_url(r2_key)

    # Log history
    db.add(History(
        user_id=user_id,
        action="tts_generated",
        metadata_={
            "voice_id": str(voice_id),
            "voice_name": voice.name,
            "text": text[:200],
            "language": language,
            "instruction": instruction[:200] if instruction else None,
            "duration_ms": duration_ms,
            "credits_used": credit_cost,
        },
    ))
    await db.commit()

    return {
        "audio_url": audio_url,
        "duration_ms": duration_ms,
        "r2_key": r2_key,
        "credits_used": credit_cost,
    }


# ── Clone via Qwen3-TTS (raw ref audio) ─────────────────────────────────────

async def generate_clone(
    db: AsyncSession,
    user_id: uuid.UUID,
    text: str,
    ref_audio_b64: str,
    language: str = "en",
    instruction: str = "",
    params=None,
) -> dict:
    """Clone a voice using Qwen3-TTS with raw base64 reference audio.

    Returns dict with audio_url, duration_ms, r2_key, credits_used.
    """
    # ── Credit deduction (pre-charge based on text length) ──
    credit_cost = estimate_tts_credits(text)
    try:
        await check_and_deduct(db, user_id, credit_cost, f"tts_clone:{text[:50]}", service_type="tts")
    except ValueError as exc:
        raise ValueError(str(exc))

    payload = {
        "mode": "clone",
        "text": text,
        "ref_audio_b64": ref_audio_b64,
        "language": language,
        "instruction": instruction,
    }
    if params:
        payload["params"] = _build_params_dict(params)

    endpoint_prefix = settings.MODAL_QWEN3_TTS_ENDPOINT
    if not endpoint_prefix:
        await refund_credits(db, user_id, credit_cost, "tts_clone_refund:no_endpoint")
        await db.commit()
        raise ValueError("MODAL_QWEN3_TTS_ENDPOINT not configured")

    url = f"{endpoint_prefix}-clone-api.modal.run"

    headers = {}
    if settings.MODAL_SHARED_SECRET:
        headers["x-tarang-modal-secret"] = settings.MODAL_SHARED_SECRET

    async with httpx.AsyncClient(timeout=300) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                await refund_credits(db, user_id, credit_cost, "tts_clone_refund:modal_error")
                await db.commit()
                raise ValueError(
                    f"Qwen3-TTS clone error (HTTP {resp.status_code}): "
                    f"{resp.text[:500]}"
                )
            audio_bytes = resp.content
        except httpx.TimeoutException:
            await refund_credits(db, user_id, credit_cost, "tts_clone_refund:timeout")
            await db.commit()
            raise ValueError("Qwen3-TTS clone took too long to respond")

    gen_id = uuid.uuid4()
    r2_key = f"tts/clone/{user_id}/{gen_id}.wav"
    try:
        upload_file(audio_bytes, r2_key)
    except Exception as exc:
        await refund_credits(db, user_id, credit_cost, "tts_clone_refund:r2_upload")
        await db.commit()
        raise ValueError(f"Failed to save cloned audio: {exc}")

    duration_ms = _get_wav_duration_ms(audio_bytes)
    audio_url = get_download_presigned_url(r2_key)

    db.add(History(
        user_id=user_id,
        action="tts_clone_generated",
        metadata_={
            "text": text[:200],
            "language": language,
            "duration_ms": duration_ms,
            "credits_used": credit_cost,
        },
    ))
    await db.commit()

    return {
        "audio_url": audio_url,
        "duration_ms": duration_ms,
        "r2_key": r2_key,
        "credits_used": credit_cost,
    }
