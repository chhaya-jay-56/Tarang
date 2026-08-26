from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from typing import List

from app.database import get_db
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.dependencies import get_current_user_optional, get_admin_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    feedback_in: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional)
):
    """
    Submit feedback. Open to public, but captures user_id if logged in.
    """
    user_id = current_user.id if current_user else None
    
    # If the user is logged in, their user_id takes precedence or just use it.
    if user_id:
        feedback_in.user_id = user_id
    elif feedback_in.user_id:
        # Prevent spoofing user_id if not logged in
        feedback_in.user_id = None
        
    db_feedback = Feedback(
        name=feedback_in.name,
        email=feedback_in.email,
        message=feedback_in.message,
        source=feedback_in.source,
        user_id=feedback_in.user_id
    )
    db.add(db_feedback)
    await db.commit()
    await db.refresh(db_feedback)
    return db_feedback

@router.get("/", response_model=List[FeedbackResponse])
async def get_all_feedback(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Admin only: Get all feedback.
    """
    result = await db.execute(select(Feedback).order_by(desc(Feedback.created_at)))
    feedbacks = result.scalars().all()
    return feedbacks
