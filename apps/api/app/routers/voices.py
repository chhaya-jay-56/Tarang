import io
import logging
import struct
import wave

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid
import httpx
import asyncio

from app.dependencies import get_db, get_current_user
from app.models.voice import Voice
from app.models.history import History
from app.schemas.voice import PresignedUrlRequest, ConfirmUploadRequest
from app.services.storage import (
    delete_file,
    get_download_presigned_url,
    get_object_metadata,
    get_upload_presigned_url,
    upload_file,
)
from app.config import settings
from app.database import AsyncSessionLocal

logger = logging.getLogger("tarang.voices")

router = APIRouter(prefix="/api/voices", tags=["voices"])

REPLICATE_BASE = "https://api.replicate.com/v1"
INDEXTTS2_VERSION = "b219b0f22f95fd97cb2c8e3bbea6827a450a7fff05674c996d83171d70b3f685"

# Stage → user-facing progress message
STAGE_MESSAGES = {
    "queued": "Starting clone...",
    "downloading_reference": "Preparing reference audio...",
    "uploading_to_ai": "Uploading to AI model...",
    "model_loading": "Loading AI model (cold start ~30s)...",
    "model_running": "Cloning your voice...",
    "downloading_output": "Processing output...",
    "saving_to_storage": "Saving cloned audio...",
    "completed": "Clone complete!",
    "failed": "Clone failed.",
}


class CloneRequest(BaseModel):
    text: str


def _get_wav_duration(file_bytes: bytes) -> float:
    """Extract duration in seconds from WAV file bytes."""
    try:
        buf = io.BytesIO(file_bytes)
        with wave.open(buf, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return round(frames / rate, 2)
    except Exception:
        pass
    return 0.0


def _replicate_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
    }


async def get_voice_for_user(
    db: AsyncSession,
    voice_id: str,
    clerk_user_id: str,
) -> Voice | None:
    result = await db.execute(
        select(Voice).where(
            Voice.voice_id == voice_id,
            Voice.clerk_user_id == clerk_user_id,
        )
    )
    return result.scalar_one_or_none()


@router.post("/get-upload-url")
async def get_upload_url(
    request: PresignedUrlRequest,
    clerk_user_id: str = Depends(get_current_user),
):
    """Generate a presigned URL for direct browser-to-R2 upload."""
    voice_id_str = str(uuid.uuid4())
    object_name = f"voices/raw/{clerk_user_id}/{voice_id_str}.wav"
    content_type = request.content_type or "audio/wav"
    
    upload_url = get_upload_presigned_url(object_name, content_type=content_type)
    
    return {
        "upload_url": upload_url,
        "voice_id": voice_id_str,
        "r2_key": object_name,
        "content_type": content_type,
    }


@router.post("/confirm-upload")
async def confirm_upload(
    request: ConfirmUploadRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a voice sample was uploaded and save to DB."""
    expected_key = f"voices/raw/{clerk_user_id}/{request.voice_id}.wav"
    if request.r2_key != expected_key:
        raise HTTPException(status_code=400, detail="Upload key does not match this user")

    metadata = get_object_metadata(request.r2_key)
    if metadata is None:
        raise HTTPException(status_code=400, detail="Upload was not found in R2")

    new_voice = Voice(
        voice_id=request.voice_id,
        clerk_user_id=clerk_user_id,
        original_filename=request.original_filename or f"voice_{request.voice_id[:8]}",
        original_file_url=request.r2_key,
        status="uploaded",
        duration_seconds=request.duration_seconds,
        file_size_bytes=metadata.get("ContentLength"),
    )
    db.add(new_voice)
    await db.commit()
    await db.refresh(new_voice)
    
    return {
        "voice_id": new_voice.voice_id,
        "status": "uploaded",
        "r2_key": new_voice.original_file_url,
        "file_size_bytes": new_voice.file_size_bytes,
    }


@router.post("/upload")
async def handle_direct_upload(
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Direct server-to-server upload bypassing browser CORS issues."""
    voice_id_str = str(uuid.uuid4())
    object_name = f"voices/raw/{clerk_user_id}/{voice_id_str}.wav"
    
    file_bytes = await file.read()
    
    # Compute real WAV duration server-side
    duration = _get_wav_duration(file_bytes)
    
    # Upload to R2 directly from Backend
    upload_file(file_bytes, object_name)
    
    # Save to db
    new_voice = Voice(
        voice_id=voice_id_str,
        clerk_user_id=clerk_user_id,
        original_filename=file.filename or f"voice_{voice_id_str[:8]}",
        original_file_url=object_name,
        status="uploaded",
        duration_seconds=duration,
        file_size_bytes=len(file_bytes),
    )
    db.add(new_voice)

    # Log upload in history
    db.add(History(
        clerk_user_id=clerk_user_id,
        voice_id=voice_id_str,
        action="uploaded",
        metadata_={
            "filename": file.filename,
            "size_bytes": len(file_bytes),
            "duration_seconds": duration,
        },
    ))

    await db.commit()
    await db.refresh(new_voice)
    
    return {
        "voice_id": new_voice.voice_id,
        "status": "uploaded",
        "r2_key": new_voice.original_file_url,
        "file_size_bytes": new_voice.file_size_bytes,
        "duration_seconds": new_voice.duration_seconds,
    }


@router.post("/{voice_id}/clone")
async def trigger_clone(
    voice_id: str,
    request: CloneRequest,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Kick off voice cloning as a background task.
    Returns immediately so the frontend can poll /status for progress.
    """
    voice_record = await get_voice_for_user(db, voice_id, clerk_user_id)
    if not voice_record:
        raise HTTPException(status_code=404, detail="Voice not found")

    if voice_record.status == "processing":
        raise HTTPException(status_code=409, detail="Cloning already in progress")

    # Mark as processing / queued immediately
    voice_record.status = "processing"
    voice_record.clone_stage = "queued"
    voice_record.error_message = None
    db.add(History(
        clerk_user_id=clerk_user_id,
        voice_id=voice_id,
        action="clone_started",
        metadata_={"text": request.text, "engine": "indextts-2"},
    ))
    await db.commit()

    # Capture values needed by background task (avoid expired ORM refs)
    original_file_url = voice_record.original_file_url

    background_tasks.add_task(
        _run_clone_pipeline,
        voice_id=voice_id,
        clerk_user_id=clerk_user_id,
        text=request.text,
        original_file_url=original_file_url,
    )

    return {"status": "processing", "voice_id": voice_id}


async def _set_stage(db: AsyncSession, voice: Voice, stage: str):
    """Update clone_stage and commit — each stage is visible to polling clients."""
    voice.clone_stage = stage
    await db.commit()
    logger.info("[clone] stage → %s", stage)


async def _fail_clone(
    db: AsyncSession,
    voice: Voice,
    clerk_user_id: str,
    voice_id: str,
    user_message: str,
    raw_error: str = "",
):
    """Mark voice as failed with a user-facing error message."""
    voice.status = "failed"
    voice.clone_stage = "failed"
    voice.error_message = user_message
    db.add(History(
        clerk_user_id=clerk_user_id,
        voice_id=voice_id,
        action="clone_failed",
        metadata_={"error": raw_error or user_message},
    ))
    await db.commit()
    logger.error("[clone] FAILED: %s | raw: %s", user_message, raw_error)


async def _run_clone_pipeline(
    voice_id: str,
    clerk_user_id: str,
    text: str,
    original_file_url: str,
):
    """
    Background clone pipeline with granular stage tracking.
    Uses its own DB session — the request session is already closed.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Voice).where(Voice.voice_id == voice_id)
        )
        voice = result.scalar_one_or_none()
        if not voice:
            logger.error("[clone] voice %s vanished before pipeline started", voice_id)
            return

        try:
            # ── Stage 1: Download reference audio from R2 ──
            await _set_stage(db, voice, "downloading_reference")
            try:
                raw_bytes = _download_from_r2(original_file_url)
            except Exception as exc:
                await _fail_clone(
                    db, voice, clerk_user_id, voice_id,
                    "Failed to retrieve your reference audio from storage",
                    str(exc),
                )
                return

            async with httpx.AsyncClient(timeout=300) as client:
                # ── Stage 2: Upload to Replicate ──
                await _set_stage(db, voice, "uploading_to_ai")
                try:
                    upload_resp = await client.post(
                        f"{REPLICATE_BASE}/files",
                        headers={"Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}"},
                        files={"content": ("voice.wav", raw_bytes, "audio/wav")},
                        data={"content_type": "audio/wav"},
                    )
                    if upload_resp.status_code not in (200, 201):
                        raise RuntimeError(upload_resp.text)
                    replicate_file_url = upload_resp.json()["urls"]["get"]
                except Exception as exc:
                    await _fail_clone(
                        db, voice, clerk_user_id, voice_id,
                        "Failed to upload audio to AI service",
                        str(exc),
                    )
                    return

                # ── Stage 3: Create prediction ──
                await _set_stage(db, voice, "model_loading")
                try:
                    pred_resp = await client.post(
                        f"{REPLICATE_BASE}/predictions",
                        headers=_replicate_headers(),
                        json={
                            "version": INDEXTTS2_VERSION,
                            "input": {
                                "text": text,
                                "speaker_audio": replicate_file_url,
                            },
                        },
                    )
                    if pred_resp.status_code not in (200, 201):
                        raise RuntimeError(pred_resp.text)
                    pred = pred_resp.json()
                    pred_id = pred["id"]
                    status = pred["status"]
                except Exception as exc:
                    await _fail_clone(
                        db, voice, clerk_user_id, voice_id,
                        f"AI model rejected the request: {exc}",
                        str(exc),
                    )
                    return

                # ── Stage 4: Poll until done ──
                poll_count = 0
                max_polls = 100  # ~5 min at 3s intervals
                while status not in ("succeeded", "failed", "canceled"):
                    # Map Replicate status to our stage
                    if status == "starting":
                        await _set_stage(db, voice, "model_loading")
                    elif status == "processing":
                        await _set_stage(db, voice, "model_running")

                    await asyncio.sleep(3)
                    poll_count += 1
                    if poll_count >= max_polls:
                        await _fail_clone(
                            db, voice, clerk_user_id, voice_id,
                            "AI model took too long to load. Please try again.",
                            "timeout",
                        )
                        return

                    poll_resp = await client.get(
                        f"{REPLICATE_BASE}/predictions/{pred_id}",
                        headers=_replicate_headers(),
                    )
                    pred = poll_resp.json()
                    status = pred["status"]
                    logger.info("[clone] polling: %s (poll %d)", status, poll_count)

                if status != "succeeded":
                    replicate_error = pred.get("error", "unknown")
                    await _fail_clone(
                        db, voice, clerk_user_id, voice_id,
                        f"Voice cloning failed: {replicate_error}",
                        replicate_error,
                    )
                    return

                output_url = pred["output"]
                logger.info("[clone] prediction succeeded, output: %s", output_url)

                # ── Stage 5: Download cloned audio ──
                await _set_stage(db, voice, "downloading_output")
                try:
                    dl_resp = await client.get(output_url, follow_redirects=True)
                    dl_resp.raise_for_status()
                    cloned_bytes = dl_resp.content
                except Exception as exc:
                    await _fail_clone(
                        db, voice, clerk_user_id, voice_id,
                        "Failed to download cloned audio from AI service",
                        str(exc),
                    )
                    return

            # ── Stage 6: Save to R2 ──
            await _set_stage(db, voice, "saving_to_storage")
            cloned_r2_key = f"voices/cloned/{clerk_user_id}/{voice_id}.wav"
            try:
                upload_file(cloned_bytes, cloned_r2_key)
            except Exception as exc:
                await _fail_clone(
                    db, voice, clerk_user_id, voice_id,
                    "Failed to save cloned audio to storage",
                    str(exc),
                )
                return

            # ── Stage 7: Completed ──
            cloned_duration = _get_wav_duration(cloned_bytes)
            voice.status = "succeeded"
            voice.clone_stage = "completed"
            voice.cloned_file_url = cloned_r2_key
            voice.error_message = None
            db.add(History(
                clerk_user_id=clerk_user_id,
                voice_id=voice_id,
                action="clone_completed",
                metadata_={
                    "text": text,
                    "engine": "indextts-2",
                    "cloned_size_bytes": len(cloned_bytes),
                    "cloned_duration_seconds": cloned_duration,
                },
            ))
            await db.commit()
            logger.info("[clone] ✅ clone complete for %s", voice_id)

        except Exception as exc:
            logger.error("[clone] unexpected error: %s", exc, exc_info=True)
            await _fail_clone(
                db, voice, clerk_user_id, voice_id,
                f"Unexpected error during cloning: {exc}",
                str(exc),
            )


def _download_from_r2(r2_key: str) -> bytes:
    """Download object bytes from R2 using boto3 (sync)."""
    from app.services.storage import get_r2_client
    s3 = get_r2_client()
    resp = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    return resp["Body"].read()


@router.get("")
async def list_voices(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all voices belonging to the authenticated user."""
    result = await db.execute(select(Voice).where(Voice.clerk_user_id == clerk_user_id))
    voices = result.scalars().all()
    return {"voices": voices, "total": len(voices)}


@router.get("/{voice_id}")
async def get_voice(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single voice details + cloning status."""
    voice_record = await get_voice_for_user(db, voice_id, clerk_user_id)
    if not voice_record:
        raise HTTPException(status_code=404, detail="Voice not found")
    return {"voice": voice_record}


@router.get("/{voice_id}/status")
async def get_clone_status(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll cloning job status with granular progress info."""
    voice_record = await get_voice_for_user(db, voice_id, clerk_user_id)
    if not voice_record:
        raise HTTPException(status_code=404, detail="Voice not found")

    stage = voice_record.clone_stage or ""
    stage_message = STAGE_MESSAGES.get(stage, "")

    if voice_record.status == "succeeded" and voice_record.cloned_file_url:
        playback_url = get_download_presigned_url(voice_record.cloned_file_url)
        return {
            "status": "succeeded",
            "clone_stage": "completed",
            "stage_message": "Clone complete!",
            "output_url": playback_url,
        }

    if voice_record.status == "failed":
        return {
            "status": "failed",
            "clone_stage": "failed",
            "stage_message": stage_message,
            "error_message": voice_record.error_message or "Clone failed",
        }

    return {
        "status": voice_record.status,
        "clone_stage": stage,
        "stage_message": stage_message,
    }


@router.get("/{voice_id}/download")
async def download_cloned_voice(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a presigned R2 download URL for the cloned audio."""
    voice_record = await get_voice_for_user(db, voice_id, clerk_user_id)
    if not voice_record:
        raise HTTPException(status_code=404, detail="Voice not found")
    if not voice_record.cloned_file_url:
        raise HTTPException(status_code=404, detail="No cloned audio available")

    download_url = get_download_presigned_url(voice_record.cloned_file_url)
    return {"download_url": download_url, "filename": f"{voice_record.original_filename}_cloned.wav"}


@router.delete("/{voice_id}")
async def delete_voice(
    voice_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a voice + its files from storage."""
    voice_record = await get_voice_for_user(db, voice_id, clerk_user_id)
    if not voice_record:
        raise HTTPException(status_code=404, detail="Voice not found")

    if voice_record.original_file_url:
        delete_file(voice_record.original_file_url)
    if voice_record.cloned_file_url:
        delete_file(voice_record.cloned_file_url)

    await db.delete(voice_record)
    await db.commit()
    return {"message": "Deleted"}
