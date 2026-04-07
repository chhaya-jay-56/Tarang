from fastapi import Depends, HTTPException, Request
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.utils.auth import verify_clerk_token

from sqlalchemy.ext.asyncio import AsyncSession

async def get_db():
    """Yields an async SQLAlchemy session, auto-closes on request end."""
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()


async def get_current_user(request: Request) -> str:
    """Extract and verify the Clerk JWT from the Authorization header.

    Returns the ``clerk_user_id`` (the JWT ``sub`` claim) on success.
    Raises 401 for missing or invalid tokens.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.removeprefix("Bearer ").strip()

    try:
        payload = verify_clerk_token(token)
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    clerk_user_id: str | None = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Token missing user identity")

    return clerk_user_id

