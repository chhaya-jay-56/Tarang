from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserResponse(BaseModel):
    """Public-facing user data."""

    clerk_user_id: str
    email: str
    name: Optional[str] = None
    plan_type: str = "free"
    credit_balance: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
