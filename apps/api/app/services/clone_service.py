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
from app.services.credit_service import (
    estimate_clone_credits,
    check_and_deduct,
    refund_credits,
)

logger = logging.getLogger("tarang.clone_service")


# ── Stage messages for frontend progress UI ──────────────────────────────────

STAGE_MESSAGES = {
    "queued": "Starting clone...",
    "downloading_reference": "Preparing reference audio...",
    "uploading_to_ai": "Sending to AI...",
    "model_loading": "Loading AI model...",
    "model_running": "Running model...",
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


def _convert_to_wav(file_bytes: bytes, filename: str) -> bytes:
    """Convert any audio format to 16kHz mono WAV using ffmpeg.

    WHY: The model (OmniVoice) expects WAV input. Users may upload
    MP3, OGG, FLAC, M4A, AAC, WEBM, WMA etc. We convert server-side
    so the frontend can accept any audio format.

    Returns WAV bytes. Raises ValueError if conversion fails.
    """
    import subprocess
    import tempfile
    import os

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "wav"

    # If already WAV, check if it's valid and return as-is
    if ext == "wav":
        try:
            buf = io.BytesIO(file_bytes)
            with wave.open(buf, "rb") as wf:
                if wf.getnframes() > 0:
                    return file_bytes
        except Exception:
            pass  # Invalid WAV, try converting anyway

    # Write to temp file, convert with ffmpeg
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as src:
        src.write(file_bytes)
        src_path = src.name

    out_path = src_path.rsplit(".", 1)[0] + "_converted.wav"

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", src_path,
                "-ar", "16000",     # 16kHz sample rate
                "-ac", "1",         # mono
                "-sample_fmt", "s16",  # 16-bit PCM
                out_path,
            ],
            capture_output=True,
            timeout=60,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")[:500]
            raise ValueError(f"ffmpeg conversion failed: {stderr}")

        with open(out_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        raise ValueError("ffmpeg not found — required for audio conversion")
    finally:
        # Cleanup temp files
        for path in [src_path, out_path]:
            try:
                os.unlink(path)
            except OSError:
                pass


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
    """Upload audio to R2 and create a UserAsset record.

    Accepts any audio format — converts to WAV via ffmpeg before storage.
    Returns the created UserAsset. Logs a History entry.
    """
    # Convert to WAV if needed (MP3, OGG, FLAC, M4A, etc.)
    try:
        wav_bytes = _convert_to_wav(file_bytes, filename)
    except ValueError as e:
        logger.warning("Audio conversion failed for %s: %s", filename, e)
        # Fallback: use original bytes (might still work for WAV files)
        wav_bytes = file_bytes

    asset_id = uuid.uuid4()
    r2_key = f"voices/raw/{user_id}/{asset_id}.wav"

    # Upload converted WAV to R2
    upload_file(wav_bytes, r2_key)

    # Compute duration from the WAV
    duration_ms = _get_wav_duration_ms(wav_bytes)

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
    voice_r2_key: str | None = None,
    speed: float = 1.0,
    voice_name: str = "",
    cached_voice_id: str = "",
) -> CloneJob:
    """Create a queued CloneJob and log History. Returns the new CloneJob.

    voice_r2_key: The ACTUAL R2 key for the voice reference audio.
    When a CustomVoice/PresetVoice is used, the proxy UserAsset has a
    dummy r2_key. This param stores the real one so the pipeline can
    download the correct reference audio.

    speed: Speaking rate multiplier (0.5=slow, 1.0=normal, 2.0=fast).
    Stored in provider_meta and forwarded to OmniVoice.

    voice_name: Name of the voice (e.g. 'shreya'). If it matches a
    pre-cached voice on the Modal worker, Whisper ASR is skipped (~8-12s saved).

    cached_voice_id: UUID string for custom voices with cached .pt prompts
    on the Modal Volume. Takes priority over voice_name for cache lookup.
    """
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

    # ── Credit deduction ──
    cached_voice = cached_voice_id or voice_name or ""
    PRESET_VOICE_NAMES = {"anjali", "priya", "alex", "david", "samay_raina"}
    is_custom = cached_voice.lower() not in PRESET_VOICE_NAMES
    
    credit_cost = estimate_clone_credits(text, is_custom)
    job_id = uuid.uuid4()
    try:
        await check_and_deduct(
            db,
            user_id,
            credit_cost,
            f"omnivoice_clone:{text[:30]}",
            clone_job_id=job_id,
            service_type="clone",
        )
    except ValueError as exc:
        raise ValueError(str(exc))

    provider_meta = {
        "endpoint": settings.MODAL_CLONE_ENDPOINT,
        "speed": speed,
        "voice_name": voice_name,
        "cached_voice_id": cached_voice_id,
    }
    # Store the real voice R2 key so the pipeline downloads the correct audio
    if voice_r2_key:
        provider_meta["voice_r2_key"] = voice_r2_key

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
        provider_meta=provider_meta,
        credit_cost=credit_cost,
        credits_deducted=True,
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
            "credits_used": credit_cost,
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
    refunded = False
    if job.credits_deducted and job.credit_cost:
        await refund_credits(
            db,
            job.user_id,
            job.credit_cost,
            "clone_failed_refund",
            clone_job_id=job.id,
        )
        job.credits_deducted = False
        refunded = True

    db.add(History(
        user_id=job.user_id,
        clone_job_id=job.id,
        action="clone_failed",
        metadata_={
            "error": raw_error or user_message,
            "credits_refunded": refunded,
        },
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

        # Get the voice reference audio R2 key.
        # WHY voice_r2_key in provider_meta: When the voice comes from
        # CustomVoice/PresetVoice, the proxy UserAsset has a dummy r2_key.
        # The real key is stored in provider_meta["voice_r2_key"].
        r2_key = None
        if job.provider_meta and job.provider_meta.get("voice_r2_key"):
            r2_key = job.provider_meta["voice_r2_key"]
        else:
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

            # ── Determine the cached_voice key for Modal ──
            # Priority: cached_voice_id (custom voice UUID) > voice_name (preset name)
            # WHY: Custom voices store .pt files by UUID, preset voices by name.
            cached_voice = ""
            if job.provider_meta:
                cached_voice = (
                    job.provider_meta.get("cached_voice_id")
                    or job.provider_meta.get("voice_name")
                    or ""
                )

            # ── Stage 2: Download reference audio from R2 ──
            # OPTIMIZATION: Skip R2 download ONLY for preset voices.
            # Presets always have raw audio on the Modal Volume as fallback,
            # so the GPU can compute the .pt on first use if needed.
            # Custom voices ALWAYS send ref_audio — the GPU tries the cached
            # .pt first but falls back to Whisper ASR if it doesn't exist yet.
            PRESET_VOICE_NAMES = {
                "anjali", "priya", "alex", "david", "samay_raina"
            }
            is_preset_cached = cached_voice.lower() in PRESET_VOICE_NAMES

            ref_b64 = ""
            if is_preset_cached:
                logger.info(
                    "[clone] Skipping R2 download — preset voice '%s'",
                    cached_voice,
                )
            else:
                try:
                    ref_bytes = _download_from_r2(r2_key)
                    ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")
                except Exception as exc:
                    await _fail_clone(
                        db, job,
                        "Failed to retrieve your reference audio from storage",
                        str(exc),
                    )
                    return

            # ── Stage 3: Send to Modal OmniVoice ──
            await _set_stage(db, job, "uploading_to_ai")

            # Read speed from provider_meta (default 1.0 if missing)
            speed = 1.0
            if job.provider_meta and job.provider_meta.get("speed"):
                speed = float(job.provider_meta["speed"])

            modal_payload = {
                "text": job.input_text,
                "ref_audio_b64": ref_b64,
                "speed": speed,
                "cached_voice": cached_voice,
            }
            if job.target_language:
                modal_payload["language"] = job.target_language

            logger.info(
                "[clone] DEBUG: cached_voice='%s', ref_b64_len=%d, provider_meta=%s",
                cached_voice, len(ref_b64), job.provider_meta,
            )

            await _set_stage(db, job, "model_loading")

            headers = {}
            if settings.MODAL_SHARED_SECRET:
                headers["x-tarang-modal-secret"] = settings.MODAL_SHARED_SECRET

            async with httpx.AsyncClient(timeout=300) as client:
                try:
                    await _set_stage(db, job, "model_running")
                    resp = await client.post(
                        settings.MODAL_CLONE_ENDPOINT,
                        json=modal_payload,
                        headers=headers,
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
