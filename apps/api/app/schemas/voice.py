from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Responses ──

class VoiceResponse(BaseModel):
    """Single voice item returned from the API."""

    voice_id: str
    original_file_url: Optional[str] = None
    cloned_file_url: Optional[str] = None
    original_filename: Optional[str] = None
    status: str  # uploaded | processing | cloned | failed
    duration_seconds: Optional[float] = None
    file_size_bytes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoiceListResponse(BaseModel):
    """Paginated list of voices."""

    voices: list[VoiceResponse]
    total: int


class CloneStatusResponse(BaseModel):
    """Polling response for clone job status."""

    voice_id: str
    status: str
    cloned_file_url: Optional[str] = None


# ── Requests ──

class VoiceUploadMeta(BaseModel):
    """Optional metadata sent alongside the file upload."""

    original_filename: Optional[str] = None
    duration_seconds: Optional[float] = None


class PresignedUrlRequest(BaseModel):
    """Request to generate a presigned URL for upload."""
    filename: Optional[str] = None
    content_type: str = "audio/wav"


class ConfirmUploadRequest(BaseModel):
    """Confirm that an upload to R2 was successful and save it."""
    voice_id: str
    r2_key: str
    original_filename: Optional[str] = None
    duration_seconds: Optional[float] = None


class CloneRequest(BaseModel):
    """Trigger a clone job for an uploaded voice."""

    voice_id: str
