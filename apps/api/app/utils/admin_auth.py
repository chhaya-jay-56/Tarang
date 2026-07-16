"""Admin authentication dependency for FastAPI.

Verifies that the caller is both:
  1. Authenticated via Clerk JWT (get_current_user)
  2. Marked as admin in the DB (users.is_admin == True)

Usage in routers:
    @router.get("/api/admin/something")
    async def admin_endpoint(user: User = Depends(get_admin_user)):
        ...
"""

import logging

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User

logger = logging.getLogger("tarang.admin")


async def get_admin_user(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that returns the User object only if they are an admin.

    Raises 403 if user is not admin, 404 if user not found.
    """
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_admin:
        logger.warning(
            "🚫 Non-admin user attempted admin access: %s", clerk_user_id
        )
        raise HTTPException(status_code=403, detail="Admin access required")

    return user
