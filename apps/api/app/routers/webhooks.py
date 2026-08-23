import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.config import settings
from app.dependencies import get_db
from app.models.user import User
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.deleted_user import DeletedUser
from app.models.app_config import AppConfig

logger = logging.getLogger("tarang.webhooks")

# ── Early-adopter config (FALLBACKS — app_config table is the primary source) ──
# These are used if app_config rows don't exist yet (fresh DB, migration pending).
EARLY_ADOPTER_CREDIT_AMOUNT = 1500   # credits granted on signup
EARLY_ADOPTER_USER_CAP = 200          # first N users get the bonus

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("", name="clerk_webhook")
@router.post("/", include_in_schema=False)
@router.post("/clerk", include_in_schema=False)
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handles Clerk webhook events for user sync.

    Verified via Svix signature. Supports:
    - user.created  → insert into DB
    - user.updated  → update email
    - user.deleted  → remove from DB
    """
    webhook_secret = settings.CLERK_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="CLERK_WEBHOOK_SECRET or CLERK_WEBHOOK_SIGNING_SECRET missing from env",
        )

    headers = request.headers
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    if not svix_id or not svix_timestamp or not svix_signature:
        logger.error(
            "❌ Missing Svix headers: id=%s, timestamp=%s, signature=%s",
            bool(svix_id), bool(svix_timestamp), bool(svix_signature),
        )
        raise HTTPException(status_code=400, detail="Missing Svix headers")

    payload = await request.body()
    decoded_payload = payload.decode("utf-8")

    wh = Webhook(webhook_secret)

    try:
        wh.verify(decoded_payload, headers)
    except WebhookVerificationError as e:
        logger.error("❌ Signature verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    import json
    event = json.loads(decoded_payload)
    if event is None:
        logger.error("❌ Decoded payload is literally 'null'")
        raise HTTPException(status_code=400, detail="Payload cannot be null")

    event_type = event.get("type")
    data = event.get("data", {})

    logger.info("📨 Webhook received: type=%s", event_type)

    try:
        if event_type == "user.created":
            await _handle_user_created(data, db)

        elif event_type == "user.updated":
            await _handle_user_updated(data, db)

        elif event_type == "user.deleted":
            await _handle_user_deleted(data, db)

        else:
            logger.info("ℹ️ Unhandled event type: %s", event_type)

    except Exception as e:
        await db.rollback()
        logger.error("❌ DB error during %s: %s", event_type, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    return {"success": True}


# ── Private helpers ──

def _extract_primary_email(data: dict) -> str:
    """Pull the primary email from Clerk's email_addresses array."""
    email_addresses = data.get("email_addresses", [])
    if not email_addresses:
        return "no-email"

    primary_email_id = data.get("primary_email_address_id")
    primary_email = next(
        (e.get("email_address") for e in email_addresses if e.get("id") == primary_email_id),
        None,
    )
    return primary_email or email_addresses[0].get("email_address", "no-email")


async def _handle_user_created(data: dict, db: AsyncSession):
    clerk_user_id = data.get("id")
    email = _extract_primary_email(data)
    name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or None

    # Read config from app_config table, fallback to hardcoded constants
    cap_result = await db.execute(
        select(AppConfig.value).where(AppConfig.key == "free_tier_cap")
    )
    cap_val = cap_result.scalar_one_or_none()
    user_cap = int(cap_val) if cap_val else EARLY_ADOPTER_USER_CAP

    credits_result = await db.execute(
        select(AppConfig.value).where(AppConfig.key == "free_tier_credits")
    )
    credits_val = credits_result.scalar_one_or_none()
    credit_amount = int(credits_val) if credits_val else EARLY_ADOPTER_CREDIT_AMOUNT

    # Count existing users to decide early-adopter credit grant
    user_count_result = await db.execute(select(func.count()).select_from(User))
    current_user_count = user_count_result.scalar()

    initial_credits = credit_amount if current_user_count < user_cap else 0

    # ── Check if this email has a deleted account (returning user) ──
    # Only look at the MOST RECENT deletion for this email.
    # Credits used from the prior account are deducted from the initial grant.
    returning_credits_used = 0
    deleted_result = await db.execute(
        select(DeletedUser.credits_used)
        .where(DeletedUser.email == email)
        .order_by(DeletedUser.deleted_at.desc())
        .limit(1)
    )
    last_deleted = deleted_result.scalar_one_or_none()
    if last_deleted is not None:
        returning_credits_used = last_deleted
        logger.info(
            "🔄 Returning user detected: email=%s, prior_credits_used=%s",
            email, returning_credits_used,
        )

    # Deduct previously-used credits from the initial grant
    adjusted_credits = max(0, initial_credits - returning_credits_used)

    new_user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        name=name,
        credit_balance=adjusted_credits,
        credit_limit=adjusted_credits,
    )
    db.add(new_user)
    await db.flush()  # Get new_user.id before creating transaction

    # Log the credit grant in the ledger (only if credits were given)
    if adjusted_credits > 0:
        txn = CreditTransaction(
            user_id=new_user.id,
            txn_type=TxnType.top_up,
            amount=adjusted_credits,
            balance_after=adjusted_credits,
        )
        db.add(txn)
        logger.info(
            "🎁 Credit grant: user=%s, credits=%s (initial=%s, prior_used=%s, user #%s)",
            clerk_user_id, adjusted_credits, initial_credits,
            returning_credits_used, current_user_count + 1,
        )

    await db.commit()
    logger.info("✅ user.created — saved %s (%s)", clerk_user_id, email)


async def _handle_user_updated(data: dict, db: AsyncSession):
    clerk_user_id = data.get("id")
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("⚠️ user.updated — %s NOT FOUND, skipping", clerk_user_id)
        return

    user.email = _extract_primary_email(data)
    name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    if name:
        user.name = name

    await db.commit()
    logger.info("✅ user.updated — updated %s", clerk_user_id)


async def _handle_user_deleted(data: dict, db: AsyncSession):
    clerk_user_id = data.get("id")
    if not clerk_user_id:
        logger.error("❌ user.deleted — no 'id' in payload!")
        return

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("⚠️ user.deleted — %s NOT FOUND, skipping", clerk_user_id)
        return

    # ── Step 1: Archive user to deleted_users table ──
    credits_used = max(0, user.credit_limit - user.credit_balance)
    deleted_record = DeletedUser(
        original_user_id=user.id,
        clerk_user_id=user.clerk_user_id,
        email=user.email,
        name=user.name,
        plan_type=user.plan_type,
        credit_balance=user.credit_balance,
        credit_limit=user.credit_limit,
        credits_used=credits_used,
        is_admin=user.is_admin,
        original_created_at=user.created_at,
    )
    db.add(deleted_record)
    logger.info(
        "📦 Archived user before deletion: %s (%s), credits_used=%s",
        clerk_user_id, user.email, credits_used,
    )

    # ── Step 2: Detach credit_transactions before user deletion ──
    # WHY: clone_jobs CASCADE-delete with the user, but credit_transactions
    # reference clone_jobs via SET NULL FK. If we don't clear clone_job_id
    # first, the CASCADE delete of clone_jobs triggers a FK check on
    # credit_transactions before our SET NULL on user_id fires.
    # Also stamp the user's email for traceability after user_id becomes NULL.
    await db.execute(
        update(CreditTransaction)
        .where(CreditTransaction.user_id == user.id)
        .values(deleted_user_email=user.email, clone_job_id=None)
    )

    # ── Step 3: Delete user from users table ──
    # CASCADE handles: user_assets, clone_jobs, history, custom_voices
    # SET NULL handles: credit_transactions.user_id
    await db.delete(user)
    await db.commit()
    logger.info("✅ user.deleted — archived and removed %s", clerk_user_id)
