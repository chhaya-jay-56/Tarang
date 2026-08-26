from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from typing import List, Optional

from app.database import get_db
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.utils.admin_auth import get_admin_user
from app.models.user import User

router = APIRouter()


async def _get_optional_clerk_id(request: Request) -> Optional[str]:
    """Extract clerk user ID from JWT if present, return None otherwise."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        from app.utils.auth import verify_clerk_token
        payload = verify_clerk_token(token)
        return payload.get("sub")
    except Exception:
        return None


@router.post("/", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    feedback_in: FeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit feedback. Open to public — no auth required.
    If a valid JWT is present, the clerk_user_id is captured automatically.
    """
    clerk_id = await _get_optional_clerk_id(request)

    # Look up the internal user if authenticated
    user_id = None
    if clerk_id:
        result = await db.execute(select(User).where(User.clerk_user_id == clerk_id))
        user = result.scalars().first()
        if user:
            user_id = user.id

    db_feedback = Feedback(
        name=feedback_in.name,
        email=feedback_in.email,
        message=feedback_in.message,
        source=feedback_in.source,
        user_id=user_id,
    )
    db.add(db_feedback)
    await db.commit()
    await db.refresh(db_feedback)
    return db_feedback


@router.get("/", response_model=List[FeedbackResponse])
async def get_all_feedback(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """
    Admin only: Get all feedback.
    """
    result = await db.execute(select(Feedback).order_by(desc(Feedback.created_at)))
    feedbacks = result.scalars().all()
    return feedbacks
