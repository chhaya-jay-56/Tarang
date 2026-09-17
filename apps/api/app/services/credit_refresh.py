# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Monthly credit refresh logic. On the 1st of each month, all users' credit
# balances are reset to their credit_limit. This is a "top-up to full" model
# — users get their full allocation each month regardless of prior usage.
#
# The actual usage history is preserved in credit_transactions (immutable
# ledger), so all-time and monthly usage stats remain accurate.
#
# FLOW:
#   1. main.py lifespan checks on startup if refresh is needed
#   2. OR admin manually triggers via POST /api/admin/monthly-refresh
#   3. This service resets balances and logs transactions
# ─────────────────────────────────────────────────────────────────────────────

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.app_config import AppConfig

logger = logging.getLogger("tarang.credit_refresh")


async def refresh_all_users_credits(db: AsyncSession) -> dict:
    """Reset all users' credit_balance to their credit_limit.

    Only refreshes users whose balance < limit (i.e., they used some credits).
    Logs a top_up transaction for each refreshed user.
    Records the refresh timestamp in app_config.

    Returns:
        dict with users_refreshed count and refresh timestamp.
    """
    result = await db.execute(
        select(User).where(
            User.credit_limit > 0,
            User.credit_balance < User.credit_limit,
        )
    )
    users = result.scalars().all()

    refreshed_count = 0
    for user in users:
        credits_to_add = user.credit_limit - user.credit_balance

        if credits_to_add <= 0:
            continue

        user.credit_balance = user.credit_limit

        # Log the refresh as a top_up transaction
        txn = CreditTransaction(
            user_id=user.id,
            txn_type=TxnType.top_up,
            amount=credits_to_add,
            balance_after=user.credit_limit,
            service_type=None,
        )
        db.add(txn)
        refreshed_count += 1

    # Record the refresh timestamp
    now = datetime.now(timezone.utc)
    refresh_key = "last_monthly_refresh"
    config_result = await db.execute(
        select(AppConfig).where(AppConfig.key == refresh_key)
    )
    config = config_result.scalar_one_or_none()

    if config:
        config.value = now.isoformat()
        config.updated_by = "system:monthly_refresh"
    else:
        new_config = AppConfig(
            key=refresh_key,
            value=now.isoformat(),
            updated_by="system:monthly_refresh",
        )
        db.add(new_config)

    await db.commit()

    logger.info(
        "🔄 Monthly credit refresh complete: %s users refreshed at %s",
        refreshed_count, now.isoformat(),
    )

    return {
        "users_refreshed": refreshed_count,
        "refresh_timestamp": now.isoformat(),
    }


async def check_and_run_monthly_refresh(db: AsyncSession) -> bool:
    """Check if a monthly refresh is needed and run it if so.

    Called on app startup. Checks if the current month's refresh has
    already been performed by comparing last_monthly_refresh to the
    1st of the current month.

    Returns True if refresh was performed, False if skipped.
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Check when the last refresh happened
    result = await db.execute(
        select(AppConfig.value).where(AppConfig.key == "last_monthly_refresh")
    )
    last_refresh_str = result.scalar_one_or_none()

    if last_refresh_str:
        try:
            last_refresh = datetime.fromisoformat(last_refresh_str)
            if last_refresh >= month_start:
                logger.info(
                    "✅ Monthly refresh already done for %s (last: %s)",
                    now.strftime("%B %Y"), last_refresh_str,
                )
                return False
        except ValueError:
            logger.warning(
                "⚠️ Invalid last_monthly_refresh value: %s, will refresh",
                last_refresh_str,
            )

    logger.info(
        "🔄 Monthly refresh needed for %s — running now",
        now.strftime("%B %Y"),
    )
    await refresh_all_users_credits(db)
    return True
