from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from app.models.call_analysis import AnalysisStatus

class CallAnalysisCreate(BaseModel):
    """Schema for initiating a new call analysis."""
    audio_url: HttpUrl
    audio_r2_key: Optional[str] = None
    filename: Optional[str] = None

class CallAnalysisResponse(BaseModel):
    """Schema for returning call analysis data."""
    id: UUID
    user_id: UUID
    status: AnalysisStatus
    filename: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    gladia_job_id: Optional[str] = None

    class Config:
        from_attributes = True

class CallAnalysisDetailResponse(CallAnalysisResponse):
    """Schema for returning full details including transcripts and intelligence."""
    transcript: Optional[Dict[str, Any]] = None
    intelligence: Optional[Dict[str, Any]] = None
    playback_url: Optional[str] = None

class CallAnalysisListResponse(BaseModel):
    """Schema for a paginated list of calls."""
    items: List[CallAnalysisResponse]
    total: int
