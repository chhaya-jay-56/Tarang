import httpx
import logging
from typing import Dict, Any

from app.config import settings
from app.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)

GLADIA_BASE_URL = "https://api.gladia.io/v2"

async def start_gladia_transcription(audio_url: str, webhook_url: str = None) -> Dict[str, Any]:
    """
    Starts an asynchronous transcription job on Gladia.
    Uses 'solaria-1' and enables intelligence flags (diarization, sentiment, NER, etc).
    """
    if not settings.GLADIA_API_KEY:
        raise ExternalServiceError("Gladia", "GLADIA_API_KEY is not configured.")

    payload = {
        "audio_url": audio_url,
        "model": "solaria-1",
        "language_config": {
            "languages": ["hi", "gu", "en"], # Hindi, Gujarati, English for Police of Ahmedabad
        },
        "diarization": True,
        "sentiment_analysis": True,
        "named_entity_recognition": True,
        "name_consistency": True,
        "enhanced_punctuation": True,
    }

    if webhook_url:
        payload["callback"] = True
        payload["callback_config"] = {
            "url": webhook_url,
            "method": "POST"
        }

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
            raise ExternalServiceError("Gladia", f"Failed to start Gladia transcription: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Gladia Connection Error: {str(e)}")
            raise ExternalServiceError("Gladia", "Could not connect to Gladia API.")


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
            raise ExternalServiceError("Gladia", f"Failed to fetch Gladia transcription: {e.response.status_code}")
