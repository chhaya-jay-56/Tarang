from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class FeedbackCreate(BaseModel):
    name: str
    email: Optional[str] = None
    message: str
    source: str = "unknown"
    user_id: Optional[UUID] = None

class FeedbackResponse(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    message: str
    source: str
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
