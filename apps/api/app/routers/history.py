import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.history import History
from app.services.storage import get_download_presigned_url

logger = logging.getLogger("tarang.history")

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def list_history(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all history entries for the authenticated user, newest first."""
    result = await db.execute(
        select(History)
        .where(History.clerk_user_id == clerk_user_id)
        .order_by(History.created_at.desc())
    )
    entries = result.scalars().all()

    items = []
    for entry in entries:
        item = {
            "id": str(entry.id),
            "voice_id": entry.voice_id,
            "action": entry.action,
            "metadata": entry.metadata_,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }

        # Attach a download URL for completed clones
        if entry.action == "clone_completed" and entry.voice_id:
            try:
                from app.models.voice import Voice

                voice_result = await db.execute(
                    select(Voice).where(Voice.voice_id == entry.voice_id)
                )
                voice = voice_result.scalar_one_or_none()
                if voice and voice.cloned_file_url:
                    item["download_url"] = get_download_presigned_url(
                        voice.cloned_file_url
                    )
            except Exception:
                pass

        items.append(item)

    return {"history": items, "total": len(items)}
