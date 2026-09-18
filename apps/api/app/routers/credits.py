# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Provides a GET endpoint for the frontend CreditBar to fetch the current
# user's credit balance and plan information. Kept minimal — just a read
# endpoint. Credit mutations happen in individual service routers (TTS,
# separation, etc.) which deduct credits atomically.
#
# FLOW: CreditBar component → useCredits hook → GET /api/credits/balance
# ─────────────────────────────────────────────────────────────────────────────

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.app_config import AppConfig

logger = logging.getLogger("tarang.credits")

router = APIRouter(prefix="/api/credits", tags=["credits"])


@router.get("/balance")
async def get_credit_balance(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user's credit balance and plan info.

    Response:
        {
            "credit_balance": 8420,
            "plan_type": "premium",
            "email": "jay@example.com"
        }
    """
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "credit_balance": user.credit_balance,
        "credit_limit": user.credit_limit,
        "plan_type": user.plan_type,
        "email": user.email,
    }


@router.get("/estimate")
async def estimate_credit_cost(
    service: str,
    char_count: int = 0,
    duration_seconds: float = 0,
    clerk_user_id: str = Depends(get_current_user),
):
    """
    Estimate credit cost for a service before processing.

    Query params:
        service: 'tts' | 'clone' | 'separation'
        char_count: Number of characters (for TTS/clone)
        duration_seconds: Audio duration in seconds (for separation)

    Response:
        { "estimated_credits": 150, "service": "tts" }
    """
    from app.services.credit_service import (
        estimate_tts_credits,
        estimate_separation_credits,
    )

    if service in ("tts", "clone"):
        if char_count <= 0:
            return {"estimated_credits": 0, "service": service}
        # Build a placeholder string of that length for estimation
        credits = estimate_tts_credits("x" * char_count)
        return {"estimated_credits": credits, "service": service}

    elif service == "separation":
        if duration_seconds <= 0:
            return {"estimated_credits": 0, "service": service}
        credits = estimate_separation_credits(duration_seconds)
        return {"estimated_credits": credits, "service": service}

    else:
        return {"estimated_credits": 0, "service": service, "note": "Unknown service"}


@router.get("/early-adopter-status")
async def get_early_adopter_status(
    db: AsyncSession = Depends(get_db),
):
    """
    Check how many early-adopter slots remain.

    No auth required — this is public info useful for marketing.

    Response:
        {
            "total_users": 142,
            "cap": 200,
            "slots_remaining": 58,
            "credit_amount": 1500,
            "promotion_active": true
        }
    """
    # Read config from app_config table (admin-editable), fallback to hardcoded
    from app.routers.webhooks import (
        EARLY_ADOPTER_CREDIT_AMOUNT,
        EARLY_ADOPTER_USER_CAP,
    )

    cap_result = await db.execute(
        select(AppConfig.value).where(AppConfig.key == "free_tier_cap")
    )
    cap_val = cap_result.scalar_one_or_none()
    cap = int(cap_val) if cap_val else EARLY_ADOPTER_USER_CAP

    credits_result = await db.execute(
        select(AppConfig.value).where(AppConfig.key == "free_tier_credits")
    )
    credits_val = credits_result.scalar_one_or_none()
    credit_amount = int(credits_val) if credits_val else EARLY_ADOPTER_CREDIT_AMOUNT

    result = await db.execute(select(func.count()).select_from(User))
    total_users = result.scalar()

    slots_remaining = max(0, cap - total_users)

    return {
        "total_users": total_users,
        "cap": cap,
        "slots_remaining": slots_remaining,
        "credit_amount": credit_amount,
        "promotion_active": slots_remaining > 0,
    }
