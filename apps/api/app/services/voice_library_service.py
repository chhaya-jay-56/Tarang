# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Business logic for the Voice Library — creating, listing, deleting saved
# voices. Decoupled from HTTP (no request/response objects).
#
# CONCEPT: Voice Library Service (per 05-architecture.md service pattern)
#   Receives clean data, returns plain data. Orchestrates R2 + DB.
#
# MODELS:
#   PresetVoice  → platform-owned voices (admin-seeded, no user_id)
#   CustomVoice  → user-created voices (has user_id, uploaded or from clone)
#
# FLOW:
#   Router → voice_library_service → storage + DB
# ─────────────────────────────────────────────────────────────────────────────

import base64
import io
import logging
import uuid
import wave

import httpx

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.preset_voice import PresetVoice
from app.models.custom_voice import CustomVoice
from app.models.clone_job import CloneJob, CloneJobStatus
from app.models.history import History
from app.services.storage import (
    upload_file,
    delete_file,
    get_download_presigned_url,
)
from app.services.credit_service import (
    check_and_deduct,
    CREDITS_VOICE_CREATION,
)
from app.config import settings

logger = logging.getLogger("tarang.voice_library")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_audio_duration_ms(file_bytes: bytes) -> int | None:
    """Extract duration from WAV file bytes. Returns None for non-WAV."""
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


async def _trigger_voice_cache(voice_id: uuid.UUID, r2_key: str) -> None:
    """Fire-and-forget: tell Modal GPU to pre-compute the Whisper prompt.

    WHY: After a custom voice is created, we want the first TTS request
    to be instant (no 8-12s Whisper). This downloads the reference audio
    from R2, base64 encodes it, and POSTs to the Modal cache_voice_api
    endpoint — which runs Whisper once and saves the .pt to Modal Volume.

    Non-blocking: failures are logged but don't affect voice creation.
    """
    endpoint = settings.MODAL_CACHE_VOICE_ENDPOINT
    if not endpoint:
        logger.warning("MODAL_CACHE_VOICE_ENDPOINT not configured — skipping prompt cache")
        return

    try:
        from app.services.storage import get_r2_client
        s3 = get_r2_client()
        resp = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
        ref_bytes = resp["Body"].read()
        ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")

        headers = {}
        if settings.MODAL_SHARED_SECRET:
            headers["x-tarang-modal-secret"] = settings.MODAL_SHARED_SECRET

        async with httpx.AsyncClient(timeout=120) as client:
            cache_resp = await client.post(
                endpoint,
                json={
                    "voice_id": str(voice_id),
                    "ref_audio_b64": ref_b64,
                },
                headers=headers,
            )
            if cache_resp.status_code == 200:
                logger.info("[voice_library] ✅ Cached prompt for voice %s", voice_id)
            else:
                logger.warning(
                    "[voice_library] ⚠️ Cache prompt failed for %s: HTTP %s",
                    voice_id, cache_resp.status_code,
                )
    except Exception as exc:
        logger.warning(
            "[voice_library] ⚠️ Failed to trigger cache for %s: %s",
            voice_id, exc,
        )


# ── Create voice ─────────────────────────────────────────────────────────────

async def create_voice(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    file_bytes: bytes,
    filename: str,
    language: str = "en",
    description: str | None = None,
) -> CustomVoice:
    """Upload reference audio to R2 and create a CustomVoice record.

    Returns the created CustomVoice. Supports WAV and MP3 uploads.
    """
    # ── Credit deduction ──
    try:
        await check_and_deduct(
            db, user_id, CREDITS_VOICE_CREATION, f"voice_creation:{name[:30]}",
            service_type="voice_creation",
        )
    except ValueError as exc:
        raise ValueError(str(exc))

    voice_id = uuid.uuid4()
    # Always store as WAV after conversion
    r2_key = f"voices/library/{user_id}/{voice_id}.wav"

    # Convert to WAV if needed (MP3, OGG, FLAC, M4A, etc.)
    from app.services.clone_service import _convert_to_wav
    try:
        wav_bytes = _convert_to_wav(file_bytes, filename)
    except ValueError:
        # Fallback: use original bytes
        wav_bytes = file_bytes

    # Upload to R2
    upload_file(wav_bytes, r2_key)

    # Try to get duration from the WAV
    duration_ms = _get_audio_duration_ms(wav_bytes)

    voice = CustomVoice(
        id=voice_id,
        user_id=user_id,
        name=name,
        description=description,
        r2_key=r2_key,
        language=language,
        duration_ms=duration_ms,
        source_type="upload",
    )
    db.add(voice)

    # Log history
    db.add(History(
        user_id=user_id,
        action="voice_created",
        metadata_={
            "voice_id": str(voice_id),
            "name": name,
            "language": language,
            "filename": filename,
            "file_size": len(file_bytes),
        },
    ))

    await db.commit()
    await db.refresh(voice)

    # Pre-compute the Whisper prompt on the GPU so the first TTS request is instant
    try:
        await _trigger_voice_cache(voice.id, r2_key)
    except Exception as exc:
        logger.warning("Voice cache trigger failed (non-fatal): %s", exc)

    return voice


# ── Save from clone job ──────────────────────────────────────────────────────

async def save_voice_from_clone(
    db: AsyncSession,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    name: str,
    language: str = "en",
    description: str | None = None,
) -> CustomVoice:
    """Create a CustomVoice from a completed clone job's output.

    The clone job's output_r2_key becomes the voice's reference audio.
    """
    result = await db.execute(
        select(CloneJob).where(
            CloneJob.id == job_id,
            CloneJob.user_id == user_id,
            CloneJob.status == CloneJobStatus.succeeded,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise ValueError("Clone job not found or not completed")
    if not job.output_r2_key:
        raise ValueError("Clone job has no output audio")

    # ── Credit deduction ──
    try:
        await check_and_deduct(
            db, user_id, CREDITS_VOICE_CREATION, f"voice_creation_from_clone:{name[:30]}",
            service_type="voice_creation",
        )
    except ValueError as exc:
        raise ValueError(str(exc))

    voice_id = uuid.uuid4()
    voice = CustomVoice(
        id=voice_id,
        user_id=user_id,
        name=name,
        description=description,
        r2_key=job.output_r2_key,
        language=language,
        duration_ms=job.output_duration_ms,
        source_type="clone_job",
        source_clone_job_id=job_id,
        metadata_={"source": "clone_job", "clone_job_id": str(job_id)},
    )
    db.add(voice)

    db.add(History(
        user_id=user_id,
        clone_job_id=job_id,
        action="voice_saved_from_clone",
        metadata_={
            "voice_id": str(voice_id),
            "name": name,
            "clone_job_id": str(job_id),
        },
    ))

    await db.commit()
    await db.refresh(voice)

    # Pre-compute the Whisper prompt for the cloned voice too
    try:
        await _trigger_voice_cache(voice.id, job.output_r2_key)
    except Exception as exc:
        logger.warning("Voice cache trigger failed (non-fatal): %s", exc)

    return voice


# ── List voices ──────────────────────────────────────────────────────────────

async def list_user_voices(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """List all voices: user's custom voices + platform presets.

    Returns a unified list of dicts with a consistent shape for both types.
    """
    # Fetch custom voices
    cv_result = await db.execute(
        select(CustomVoice)
        .where(CustomVoice.user_id == user_id)
        .order_by(CustomVoice.created_at.desc())
    )
    custom_voices = list(cv_result.scalars().all())

    # Fetch preset voices
    pv_result = await db.execute(
        select(PresetVoice).order_by(PresetVoice.name.asc())
    )
    preset_voices = list(pv_result.scalars().all())

    # Build unified list — presets first, then custom
    voices = []
    for pv in preset_voices:
        voices.append({
            "id": str(pv.id),
            "name": pv.name,
            "description": pv.description,
            "voice_type": "preset",
            "language": pv.language,
            "duration_ms": pv.duration_ms,
            "is_preset": True,
            "r2_key": pv.r2_key,
            "created_at": pv.created_at,
        })
    for cv in custom_voices:
        voices.append({
            "id": str(cv.id),
            "name": cv.name,
            "description": cv.description,
            "voice_type": "custom",
            "language": cv.language,
            "duration_ms": cv.duration_ms,
            "is_preset": False,
            "r2_key": cv.r2_key,
            "created_at": cv.created_at,
        })

    return voices


# ── Delete voice ─────────────────────────────────────────────────────────────

async def delete_saved_voice(
    db: AsyncSession,
    voice_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Delete a custom voice. Only custom (non-preset) voices can be deleted."""
    result = await db.execute(
        select(CustomVoice).where(
            CustomVoice.id == voice_id,
            CustomVoice.user_id == user_id,
        )
    )
    voice = result.scalar_one_or_none()
    if voice is None:
        raise ValueError("Voice not found or is a preset voice")

    # Delete from R2
    try:
        delete_file(voice.r2_key)
    except Exception as exc:
        logger.warning("Failed to delete R2 file %s: %s", voice.r2_key, exc)

    await db.delete(voice)
    await db.commit()


# ── Get audio URL ────────────────────────────────────────────────────────────

async def get_voice_audio_url(
    db: AsyncSession,
    voice_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Generate a presigned R2 URL for a voice's reference audio.

    Checks both CustomVoice and PresetVoice tables.
    CustomVoice is scoped by user_id to prevent BOLA (per 13-security.md §6).
    PresetVoice is platform-wide — no user scoping needed.
    """
    # Try CustomVoice first (user-scoped)
    cv_result = await db.execute(
        select(CustomVoice).where(
            CustomVoice.id == voice_id,
            CustomVoice.user_id == user_id,
        )
    )
    voice = cv_result.scalar_one_or_none()

    if voice is None:
        # Try PresetVoice (platform-wide, no user scoping)
        pv_result = await db.execute(
            select(PresetVoice).where(PresetVoice.id == voice_id)
        )
        voice = pv_result.scalar_one_or_none()

    if voice is None:
        raise ValueError("Voice not found")

    url = get_download_presigned_url(voice.r2_key)
    return {"audio_url": url, "r2_key": voice.r2_key}

