import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.history import History
from app.models.clone_job import CloneJob, CloneJobStatus
from app.services.clone_service import resolve_user_id
from app.services.storage import get_download_presigned_url

logger = logging.getLogger("tarang.history")

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def list_history(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all history entries for the authenticated user, newest first.

    Resolves clerk_user_id → UUID user_id (History FKs to users.id).
    Attaches presigned download URLs for completed clone jobs.
    """
    try:
        user_id = await resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(History)
        .where(History.user_id == user_id)
        .order_by(History.created_at.desc())
    )
    entries = result.scalars().all()

    items = []
    for entry in entries:
        item = {
            "id": str(entry.id),
            "action": entry.action,
            "metadata": entry.metadata_,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "clone_job_id": str(entry.clone_job_id) if entry.clone_job_id else None,
        }

        # Attach a download URL for completed clones via CloneJob
        if entry.action == "clone_completed" and entry.clone_job_id:
            try:
                job_result = await db.execute(
                    select(CloneJob).where(
                        CloneJob.id == entry.clone_job_id,
                        CloneJob.status == CloneJobStatus.succeeded,
                    )
                )
                job = job_result.scalar_one_or_none()
                if job and job.output_r2_key:
                    item["download_url"] = get_download_presigned_url(
                        job.output_r2_key
                    )
            except Exception:
                pass

        items.append(item)

    return {"history": items, "total": len(items)}
