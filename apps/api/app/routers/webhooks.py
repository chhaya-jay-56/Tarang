import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.config import settings
from app.dependencies import get_db
from app.models.user import User
from app.models.credit_transaction import CreditTransaction, TxnType

logger = logging.getLogger("tarang.webhooks")

# ── Early-adopter config ──────────────────────────────────────────────────
# First N users who sign up get a welcome credit grant.
# Change these constants to adjust the promotion.
EARLY_ADOPTER_CREDIT_AMOUNT = 1500   # credits granted on signup
EARLY_ADOPTER_USER_CAP = 200          # first N users get the bonus
# ──────────────────────────────────────────────────────────────────────────

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
        event = wh.verify(decoded_payload, headers)
    except WebhookVerificationError as e:
        logger.error("❌ Signature verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

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
        raise HTTPException(status_code=500, detail="Internal server error")

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

    # Count existing users to decide early-adopter credit grant
    user_count_result = await db.execute(select(func.count()).select_from(User))
    current_user_count = user_count_result.scalar()

    initial_credits = (
        EARLY_ADOPTER_CREDIT_AMOUNT
        if current_user_count < EARLY_ADOPTER_USER_CAP
        else 0
    )

    new_user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        name=name,
        credit_balance=initial_credits,
    )
    db.add(new_user)
    await db.flush()  # Get new_user.id before creating transaction

    # Log the credit grant in the ledger (only if credits were given)
    if initial_credits > 0:
        txn = CreditTransaction(
            user_id=new_user.id,
            txn_type=TxnType.top_up,
            amount=initial_credits,
            balance_after=initial_credits,
        )
        db.add(txn)
        logger.info(
            "🎁 Early-adopter bonus: user=%s, credits=%s (user #%s)",
            clerk_user_id, initial_credits, current_user_count + 1,
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

    await db.delete(user)
    await db.commit()
    logger.info("✅ user.deleted — removed %s", clerk_user_id)
