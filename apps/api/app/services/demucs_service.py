# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Service layer for Demucs voice separation — calls the Modal GPU endpoint.
# Completely decoupled from HTTP (no request/response objects).
# Called by the separation router (controller layer) and later by
# dub_service.py (Phase 2 of the dubbing pipeline).
#
# CONCEPT: Service Layer (from standards/05-architecture.md §3)
#   - Receives clean validated data in, returns plain data out.
#   - Orchestrates: Modal API call for Demucs separation.
#   - This is what you unit test most heavily.
#
# FLOW:
#   Router → demucs_service → Modal Demucs endpoint → R2
#
# WHY STATELESS:
#   No DB writes here. The Modal worker handles R2 uploads directly.
#   When integrated into the dubbing pipeline, dub_service.py writes
#   the R2 keys to dub_jobs.vocal_r2_key / instrumental_r2_key.
# ─────────────────────────────────────────────────────────────────────────────

import logging
import uuid

import httpx

from app.config import settings

logger = logging.getLogger("tarang.demucs_service")


class DemucsError(Exception):
    """Raised when the Demucs Modal endpoint returns an error."""
    pass


async def separate_audio(
    audio_r2_key: str,
    job_id: str | None = None,
) -> dict:
    """Call Modal Demucs endpoint to separate vocals from instrumental.

    Args:
        audio_r2_key: R2 object key for the source audio file
            (e.g. "dub/{job_id}/full_audio.wav")
        job_id: Optional job ID for R2 key namespacing.
            If None, generates a UUID (useful for standalone test calls).

    Returns:
        dict with keys:
            - vocal_r2_key: R2 key for separated vocals
            - instrumental_r2_key: R2 key for instrumental track
            - vocals_size_bytes: file size of vocals
            - instrumental_size_bytes: file size of instrumental
            - sample_rate: output sample rate

    Raises:
        DemucsError: if Modal endpoint returns an error or times out
        ValueError: if MODAL_DEMUCS_ENDPOINT is not configured
    """
    endpoint = settings.MODAL_DEMUCS_ENDPOINT
    if not endpoint:
        raise ValueError(
            "MODAL_DEMUCS_ENDPOINT not configured — "
            "deploy the Demucs Modal worker first: modal deploy apps/ai_workers/demucs/modal_app.py"
        )

    if job_id is None:
        job_id = str(uuid.uuid4())

    payload = {
        "audio_r2_key": audio_r2_key,
        "job_id": job_id,
    }

    logger.info(
        "[demucs] Calling Modal endpoint for job %s (audio: %s)",
        job_id,
        audio_r2_key,
    )

    headers = {}
    if settings.MODAL_SHARED_SECRET:
        headers["x-tarang-modal-secret"] = settings.MODAL_SHARED_SECRET

    async with httpx.AsyncClient(timeout=600) as client:
        try:
            resp = await client.post(endpoint, json=payload, headers=headers)

            if resp.status_code != 200:
                error_detail = resp.text[:500]
                logger.error(
                    "[demucs] Modal returned HTTP %d: %s",
                    resp.status_code,
                    error_detail,
                )
                raise DemucsError(
                    f"Demucs separation failed (HTTP {resp.status_code}): {error_detail}"
                )

            result = resp.json()
            logger.info(
                "[demucs] ✅ Separation complete — vocals: %s, instrumental: %s",
                result.get("vocal_r2_key"),
                result.get("instrumental_r2_key"),
            )
            return result

        except httpx.TimeoutException:
            logger.error("[demucs] Modal endpoint timed out (600s)")
            raise DemucsError(
                "Demucs separation timed out. The audio file may be too long."
            )
        except httpx.RequestError as exc:
            logger.error("[demucs] Failed to reach Modal endpoint: %s", exc)
            raise DemucsError(
                f"Failed to communicate with Demucs service: {exc}"
            )
