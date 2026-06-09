from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Requests ──

class CreateVoiceRequest(BaseModel):
    """Create a new saved voice (sent as form fields alongside file upload)."""
    name: str
    description: Optional[str] = None
    language: str = "en"


class SaveVoiceFromCloneRequest(BaseModel):
    """Save a completed clone job's output as a reusable voice."""
    job_id: str
    name: str
    description: Optional[str] = None
    language: str = "en"


# ── Responses ──

class SavedVoiceResponse(BaseModel):
    """Voice entry in the voice library."""
    id: str
    name: str
    description: Optional[str] = None
    voice_type: str
    language: str
    duration_ms: Optional[int] = None
    is_preset: bool
    audio_url: Optional[str] = None
    r2_key: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VoiceLibraryResponse(BaseModel):
    """Full voice library listing — user voices + presets."""
    voices: list[SavedVoiceResponse]
    total: int
