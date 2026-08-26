import httpx
import logging
from typing import Dict, Any

from app.config import settings
from app.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)

GLADIA_BASE_URL = "https://api.gladia.io/v2"


async def upload_audio_to_gladia(file_bytes: bytes, filename: str) -> str:
    """
    Uploads raw audio bytes directly to Gladia's /v2/upload endpoint.
    Returns Gladia's internal audio_url (e.g. https://api.gladia.io/file/...).
    """
    if not settings.GLADIA_API_KEY:
        raise ExternalServiceError("Gladia", "GLADIA_API_KEY is not configured.")

    headers = {
        "x-gladia-key": settings.GLADIA_API_KEY,
    }
    files = {
        "audio": (filename, file_bytes, "audio/mpeg" if filename.endswith(".mp3") else "audio/wav")
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(f"{GLADIA_BASE_URL}/upload", files=files, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["audio_url"]
        except httpx.HTTPStatusError as e:
            logger.error(f"Gladia Upload Error: {e.response.text}")
            raise ExternalServiceError("Gladia", f"Gladia audio upload failed: {e.response.text}")
        except Exception as e:
            logger.error(f"Gladia Upload Connection Error: {str(e)}")
            raise ExternalServiceError("Gladia", f"Could not connect to Gladia upload API: {str(e)}")


async def start_gladia_transcription(
    audio_url: str,
    source_language: str | None = None,
    translation: bool = False,
    translation_target_language: str | None = None,
) -> Dict[str, Any]:
    """
    Starts an asynchronous transcription job on Gladia.
    Uses 'solaria-1' and enables intelligence flags (diarization, sentiment, NER, etc).
    """
    if not settings.GLADIA_API_KEY:
        raise ExternalServiceError("Gladia", "GLADIA_API_KEY is not configured.")

    if translation and not translation_target_language:
        raise ExternalServiceError("Gladia", "A target language is required when translation is enabled.")

    payload = {
        "audio_url": audio_url,
        "custom_vocabulary": False,
        "translation": translation,
        "custom_spelling": False,
        # Omit a languages list so Gladia detects the spoken language at runtime.
        # Code switching allows recordings that move between supported languages.
        "language_config": {
            "code_switching": True,
        },
        "diarization": True,
        "diarization_config": {
            "enhanced": True,          # Enhanced speaker diarization
        },
        "name_consistency": True,
        "punctuation_enhanced": True,
        "sentiment_analysis": True,
        "named_entity_recognition": True,
        "model": "solaria-1",
        "callback": False,             # We poll — no webhook needed
    }
    if translation:
        payload["translation_config"] = {
            "target_languages": [translation_target_language],
            "model": "base",
        }
    if source_language:
        payload["language_config"]["languages"] = [source_language]

    headers = {
        "Content-Type": "application/json",
        "x-gladia-key": settings.GLADIA_API_KEY,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(f"{GLADIA_BASE_URL}/pre-recorded", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except httpx.HTTPStatusError as e:
            logger.error(f"Gladia API Error: {e.response.text}")
            raise ExternalServiceError("Gladia", f"Failed to start Gladia transcription: {e.response.text}")
        except Exception as e:
            logger.error(f"Gladia Connection Error: {str(e)}")
            raise ExternalServiceError("Gladia", f"Could not connect to Gladia API: {str(e)}")


async def get_gladia_transcription(job_id: str) -> Dict[str, Any]:
    """
    Fetches the result of a completed Gladia transcription job.
    """
    headers = {
        "x-gladia-key": settings.GLADIA_API_KEY,
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{GLADIA_BASE_URL}/pre-recorded/{job_id}", headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Gladia API Error fetching job {job_id}: {e.response.text}")
            raise ExternalServiceError("Gladia", f"Failed to fetch Gladia transcription: {e.response.text}")
