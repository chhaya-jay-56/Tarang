# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Admin-only endpoints for user management, credit management, app config,
# and platform insights. All endpoints are protected by get_admin_user()
# which verifies both JWT auth AND users.is_admin flag.
#
# ENDPOINT GROUPS:
#   /api/admin/users/*     — search, list, view, edit user credit limits
#   /api/admin/config/*    — read/write app_config table
#   /api/admin/insights/*  — top spenders, service usage, idle users, overview
#   /api/admin/bulk-reassign — batch credit limit updates
# ─────────────────────────────────────────────────────────────────────────────

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, update, func, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.user import User
from app.models.app_config import AppConfig
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.deleted_user import DeletedUser
from app.utils.admin_auth import get_admin_user

logger = logging.getLogger("tarang.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Request/Response schemas ─────────────────────────────────────────────────

class CreditLimitUpdate(BaseModel):
    new_limit: int

class BulkReassignRequest(BaseModel):
    new_limit: int
    before_date: Optional[str] = None  # ISO date string, e.g. "2026-07-01"
    max_users: Optional[int] = None    # e.g. 200 for "first 200 users"

class ConfigUpdate(BaseModel):
    value: str


# ── User Management ──────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with credit info, paginated."""
    offset = (page - 1) * per_page

    # Total count
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar()

    # Paginated users
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    users = result.scalars().all()

    return {
        "users": [_user_to_dict(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=1),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by name or email (case-insensitive partial match)."""
    pattern = f"%{q}%"
    result = await db.execute(
        select(User).where(
            (User.name.ilike(pattern)) | (User.email.ilike(pattern))
        ).order_by(User.created_at.desc())
        .limit(50)
    )
    users = result.scalars().all()
    return {"users": [_user_to_dict(u) for u in users], "total": len(users)}


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info for a single user by UUID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_to_dict(user)


@router.patch("/users/{user_id}/credit-limit")
async def update_credit_limit(
    user_id: str,
    body: CreditLimitUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's credit limit and adjust their balance accordingly.

    When bumping from 1500→2000:
      - credit_limit = 2000
      - credit_balance += 500 (the delta)
      - Logs a top_up transaction for the delta
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.new_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit cannot be negative")

    old_limit = user.credit_limit
    delta = body.new_limit - old_limit

    user.credit_limit = body.new_limit

    # Adjust balance by the delta — if bumping up, user gets more credits;
    # if reducing, balance decreases (but never below 0 due to DB CHECK)
    new_balance = max(0, user.credit_balance + delta)
    user.credit_balance = new_balance

    # Log transaction if credits were added
    if delta > 0:
        txn = CreditTransaction(
            user_id=user.id,
            txn_type=TxnType.top_up,
            amount=delta,
            balance_after=new_balance,
            service_type=None,
        )
        db.add(txn)

    await db.commit()

    logger.info(
        "📝 Admin credit limit update: user=%s, %s→%s (delta=%+d), by=%s",
        user_id, old_limit, body.new_limit, delta, admin.clerk_user_id,
    )

    return {
        "user_id": user_id,
        "old_limit": old_limit,
        "new_limit": body.new_limit,
        "credit_balance": new_balance,
        "delta": delta,
    }


# ── Bulk Operations ──────────────────────────────────────────────────────────

@router.post("/bulk-reassign")
async def bulk_reassign_credits(
    body: BulkReassignRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk update credit_limit for a group of users (e.g. first 200).

    Identifies users by created_at ordering. Each user's credit_balance
    is adjusted by the delta between their old and new credit_limit.
    """
    if body.new_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit cannot be negative")

    # Build the query for target users
    query = select(User).order_by(User.created_at.asc())

    if body.before_date:
        query = query.where(User.created_at < body.before_date)

    if body.max_users:
        query = query.limit(body.max_users)

    result = await db.execute(query)
    users = result.scalars().all()

    updated_count = 0
    for user in users:
        old_limit = user.credit_limit
        delta = body.new_limit - old_limit

        if delta == 0:
            continue

        user.credit_limit = body.new_limit
        new_balance = max(0, user.credit_balance + delta)
        user.credit_balance = new_balance

        if delta > 0:
            txn = CreditTransaction(
                user_id=user.id,
                txn_type=TxnType.top_up,
                amount=delta,
                balance_after=new_balance,
                service_type=None,
            )
            db.add(txn)

        updated_count += 1

    await db.commit()

    logger.info(
        "📝 Admin bulk reassign: new_limit=%s, updated=%s users, by=%s",
        body.new_limit, updated_count, admin.clerk_user_id,
    )

    return {
        "new_limit": body.new_limit,
        "users_updated": updated_count,
        "users_scanned": len(users),
    }


# ── App Config ───────────────────────────────────────────────────────────────

@router.get("/config")
async def list_config(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all app config entries."""
    result = await db.execute(select(AppConfig).order_by(AppConfig.key))
    configs = result.scalars().all()
    return {
        "configs": [
            {
                "key": c.key,
                "value": c.value,
                "updated_by": c.updated_by,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in configs
        ]
    }


@router.patch("/config/{key}")
async def update_config(
    key: str,
    body: ConfigUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a config value by key."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == key))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config key '{key}' not found")

    old_value = config.value
    config.value = body.value
    config.updated_by = admin.clerk_user_id
    await db.commit()

    logger.info(
        "📝 Admin config update: %s = %s→%s, by=%s",
        key, old_value, body.value, admin.clerk_user_id,
    )

    return {"key": key, "old_value": old_value, "new_value": body.value}


# ── Insights ─────────────────────────────────────────────────────────────────

@router.get("/insights/overview")
async def insights_overview(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """High-level platform stats."""
    total_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_result.scalar()

    active_result = await db.execute(
        select(func.count()).select_from(User)
        .where(User.credit_balance < User.credit_limit)
    )
    active_users = active_result.scalar()

    credits_issued_result = await db.execute(
        select(func.coalesce(func.sum(User.credit_limit), 0)).select_from(User)
    )
    total_credits_issued = credits_issued_result.scalar()

    credits_used_result = await db.execute(
        select(
            func.coalesce(
                func.sum(User.credit_limit - User.credit_balance), 0
            )
        ).select_from(User)
    )
    total_credits_used = credits_used_result.scalar()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_credits_issued": total_credits_issued,
        "total_credits_used": total_credits_used,
    }


@router.get("/insights/top-spenders")
async def top_spenders(
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Top users by credits consumed."""
    result = await db.execute(
        select(User)
        .where(User.credit_limit > 0)
        .order_by((User.credit_limit - User.credit_balance).desc())
        .limit(limit)
    )
    users = result.scalars().all()

    return {
        "users": [
            {
                **_user_to_dict(u),
                "credits_used": u.credit_limit - u.credit_balance,
                "usage_pct": round(
                    100.0 * (u.credit_limit - u.credit_balance) / u.credit_limit, 1
                ) if u.credit_limit > 0 else 0,
            }
            for u in users
        ]
    }


@router.get("/insights/service-usage")
async def service_usage(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Credits consumed per service type (from credit_transactions)."""
    result = await db.execute(
        select(
            func.coalesce(CreditTransaction.service_type, "unknown").label("service"),
            func.sum(CreditTransaction.amount).label("total_credits"),
            func.count().label("num_transactions"),
        )
        .where(CreditTransaction.txn_type == TxnType.deduction)
        .group_by(CreditTransaction.service_type)
        .order_by(func.sum(CreditTransaction.amount).desc())
    )
    rows = result.all()

    return {
        "services": [
            {
                "service": row.service,
                "total_credits": row.total_credits,
                "num_transactions": row.num_transactions,
            }
            for row in rows
        ]
    }


@router.get("/insights/idle-users")
async def idle_users(
    threshold_pct: float = Query(10.0, ge=0, le=100),
    days_old: int = Query(14, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Users who signed up >N days ago but used less than X% of credits.

    These are candidates for credit reallocation.
    """
    cutoff = func.now() - text(f"interval '{days_old} days'")

    result = await db.execute(
        select(User)
        .where(
            User.credit_limit > 0,
            User.created_at < cutoff,
            (User.credit_limit - User.credit_balance) < (threshold_pct / 100.0 * User.credit_limit),
        )
        .order_by(User.created_at.asc())
        .limit(limit)
    )
    users = result.scalars().all()

    return {
        "users": [
            {
                **_user_to_dict(u),
                "credits_used": u.credit_limit - u.credit_balance,
                "usage_pct": round(
                    100.0 * (u.credit_limit - u.credit_balance) / u.credit_limit, 1
                ) if u.credit_limit > 0 else 0,
            }
            for u in users
        ],
        "threshold_pct": threshold_pct,
        "days_old": days_old,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    """Serialize a User row for admin API responses."""
    return {
        "id": str(user.id),
        "clerk_user_id": user.clerk_user_id,
        "email": user.email,
        "name": user.name,
        "plan_type": user.plan_type,
        "credit_balance": user.credit_balance,
        "credit_limit": user.credit_limit,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


# ── Deleted Users ────────────────────────────────────────────────────────────

@router.get("/deleted-users")
async def list_deleted_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all deleted/archived user accounts, paginated.

    Shows email, credits_used, deletion time — useful for auditing
    delete-and-re-signup patterns.
    """
    offset = (page - 1) * per_page

    count_result = await db.execute(
        select(func.count()).select_from(DeletedUser)
    )
    total = count_result.scalar()

    result = await db.execute(
        select(DeletedUser)
        .order_by(DeletedUser.deleted_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    deleted = result.scalars().all()

    return {
        "deleted_users": [
            {
                "id": str(d.id),
                "original_user_id": str(d.original_user_id),
                "clerk_user_id": d.clerk_user_id,
                "email": d.email,
                "name": d.name,
                "plan_type": d.plan_type,
                "credit_balance": d.credit_balance,
                "credit_limit": d.credit_limit,
                "credits_used": d.credits_used,
                "is_admin": d.is_admin,
                "original_created_at": (
                    d.original_created_at.isoformat()
                    if d.original_created_at else None
                ),
                "deleted_at": (
                    d.deleted_at.isoformat() if d.deleted_at else None
                ),
            }
            for d in deleted
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }
