import os
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_db
from app.models.user import User

logger = logging.getLogger("tarang.webhooks")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handles Clerk webhook events for user sync.

    Verified via Svix signature. Supports:
    - user.created  → insert into DB
    - user.updated  → update email
    - user.deleted  → remove from DB
    """
    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SECRET missing from env")

    headers = request.headers
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    if not svix_id or not svix_timestamp or not svix_signature:
        logger.error(f"❌ Missing Svix headers: id={bool(svix_id)}, timestamp={bool(svix_timestamp)}, signature={bool(svix_signature)}")
        raise HTTPException(status_code=400, detail="Missing Svix headers")

    payload = await request.body()
    decoded_payload = payload.decode("utf-8")

    wh = Webhook(webhook_secret)

    try:
        event = wh.verify(decoded_payload, headers)
    except WebhookVerificationError as e:
        logger.error(f"❌ Signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    data = event.get("data", {})

    logger.info(f"📨 Webhook received: type={event_type}")

    try:
        if event_type == "user.created":
            await _handle_user_created(data, db)

        elif event_type == "user.updated":
            await _handle_user_updated(data, db)

        elif event_type == "user.deleted":
            await _handle_user_deleted(data, db)

        else:
            logger.info(f"ℹ️ Unhandled event type: {event_type}")

    except Exception as e:
        await db.rollback()
        logger.error(f"❌ DB error during {event_type}: {e}")
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")

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

    new_user = User(clerk_user_id=clerk_user_id, email=email, name=name)
    db.add(new_user)
    await db.commit()
    logger.info(f"✅ user.created — saved {clerk_user_id} ({email})")


async def _handle_user_updated(data: dict, db: AsyncSession):
    clerk_user_id = data.get("id")
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"⚠️ user.updated — {clerk_user_id} NOT FOUND, skipping")
        return

    user.email = _extract_primary_email(data)
    name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    if name:
        user.name = name

    await db.commit()
    logger.info(f"✅ user.updated — updated {clerk_user_id}")


async def _handle_user_deleted(data: dict, db: AsyncSession):
    clerk_user_id = data.get("id")
    if not clerk_user_id:
        logger.error(f"❌ user.deleted — no 'id' in payload!")
        return

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        logger.warning(f"⚠️ user.deleted — {clerk_user_id} NOT FOUND, skipping")
        return

    await db.delete(user)
    await db.commit()
    logger.info(f"✅ user.deleted — removed {clerk_user_id}")
