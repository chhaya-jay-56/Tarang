from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class HistoryItemResponse(BaseModel):
    """Single history entry for the history tab."""

    id: str
    voice_id: Optional[str] = None
    action: str  # uploaded | clone_started | clone_completed | clone_failed
    metadata_: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HistoryListResponse(BaseModel):
    """Paginated history list."""

    history: list[HistoryItemResponse]
    total: int
