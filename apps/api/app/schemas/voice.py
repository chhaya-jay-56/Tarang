from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Requests ──

class CloneRequest(BaseModel):
    """Trigger a clone job for an uploaded voice asset."""
    text: str
    target_language: str = ""  # OmniVoice language ID (e.g. "en", "hi", "zh")
    language: str = ""  # Deprecated alias — kept for backward compat
    speed: float = 1.0  # Speaking rate (0.5=slow, 1.0=normal, 2.0=fast)

    @property
    def resolved_target_language(self) -> str:
        """Return target_language, falling back to legacy `language` field."""
        return self.target_language or self.language


# ── Responses ──

class AssetResponse(BaseModel):
    """Voice asset metadata returned from the API."""
    id: str
    asset_type: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    duration_ms: Optional[int] = None
    r2_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    """List of voice assets."""
    assets: list[AssetResponse]
    total: int


class CloneJobResponse(BaseModel):
    """Clone job tracking response."""
    id: str
    status: str
    clone_stage: Optional[str] = None
    stage_message: Optional[str] = None
    output_url: Optional[str] = None
    error_message: Optional[str] = None


class UploadResponse(BaseModel):
    """Response after uploading a voice sample."""
    asset_id: str
    status: str
    r2_key: str
    file_size: Optional[int] = None
    duration_ms: Optional[int] = None


class DownloadResponse(BaseModel):
    """Response with presigned download URL."""
    download_url: str
    filename: str


# ── Legacy schemas (kept for backward compatibility) ──

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
