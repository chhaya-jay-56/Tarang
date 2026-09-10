# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Core email service — wraps Resend API, queries user segments, and sends
# emails with dedup protection via the email_events table.
#
# DESIGN DECISIONS:
#   - No Celery beat automation at 77 users — all sends are admin-triggered
#   - Segment queries use existing users + credit_transactions tables
#   - Dedup: check email_events before sending, INSERT after send succeeds
#   - Used features derived from credit_transactions.service_type
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from typing import Optional

import resend
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.email_event import EmailEvent
from app.services import email_templates

logger = logging.getLogger("tarang.email")


def _init_resend():
    """Initialize Resend with API key."""
    resend.api_key = settings.RESEND_API_KEY


# ── Segment Queries ──────────────────────────────────────────────────────────

async def get_segment_users(
    segment: str,
    db: AsyncSession,
) -> list[User]:
    """Query users belonging to a segment.

    Segments:
      - "never_used": credit_balance == credit_limit (zero credits spent)
      - "used_once": spent credits but no deduction in last 7 days
      - "all": everyone with credit_limit > 0
    """
    if segment == "never_used":
        result = await db.execute(
            select(User).where(
                User.credit_limit > 0,
                User.credit_balance == User.credit_limit,
            ).order_by(User.created_at.asc())
        )
    elif segment == "used_once":
        # Users who used credits but have no recent activity (7+ days)
        result = await db.execute(
            select(User).where(
                User.credit_limit > 0,
                User.credit_balance < User.credit_limit,  # used some credits
                ~User.id.in_(
                    select(CreditTransaction.user_id).where(
                        CreditTransaction.txn_type == TxnType.deduction,
                        CreditTransaction.created_at > func.now() - text("interval '7 days'"),
                    ).distinct()
                ),
            ).order_by(User.created_at.asc())
        )
    elif segment == "all":
        result = await db.execute(
            select(User).where(
                User.credit_limit > 0,
            ).order_by(User.created_at.asc())
        )
    else:
        raise ValueError(f"Unknown segment: {segment}")

    return list(result.scalars().all())


async def get_segment_counts(db: AsyncSession) -> dict:
    """Get user counts for each segment."""
    never_used = await db.execute(
        select(func.count()).select_from(User).where(
            User.credit_limit > 0,
            User.credit_balance == User.credit_limit,
        )
    )
    used_once = await db.execute(
        select(func.count()).select_from(User).where(
            User.credit_limit > 0,
            User.credit_balance < User.credit_limit,
            ~User.id.in_(
                select(CreditTransaction.user_id).where(
                    CreditTransaction.txn_type == TxnType.deduction,
                    CreditTransaction.created_at > func.now() - text("interval '7 days'"),
                ).distinct()
            ),
        )
    )
    all_users = await db.execute(
        select(func.count()).select_from(User).where(User.credit_limit > 0)
    )

    return {
        "never_used": never_used.scalar() or 0,
        "used_once": used_once.scalar() or 0,
        "all": all_users.scalar() or 0,
    }


async def get_used_features(user_id, db: AsyncSession) -> list[str]:
    """Get list of service_types a user has used (from credit_transactions)."""
    result = await db.execute(
        select(CreditTransaction.service_type)
        .where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.txn_type == TxnType.deduction,
            CreditTransaction.service_type.isnot(None),
        )
        .distinct()
    )
    return [row[0] for row in result.all() if row[0]]


async def has_already_received(
    user_id,
    email_type: str,
    db: AsyncSession,
) -> bool:
    """Check if user already received this email type (dedup guard)."""
    result = await db.execute(
        select(func.count()).select_from(EmailEvent).where(
            EmailEvent.user_id == user_id,
            EmailEvent.email_type == email_type,
        )
    )
    return (result.scalar() or 0) > 0


async def record_email_sent(
    user_id,
    email_type: str,
    subject: str,
    campaign_id: Optional[str],
    db: AsyncSession,
):
    """Record that an email was sent (INSERT into email_events)."""
    event = EmailEvent(
        user_id=user_id,
        email_type=email_type,
        subject=subject,
        campaign_id=campaign_id,
    )
    db.add(event)
    await db.flush()


# ── Email Sending ────────────────────────────────────────────────────────────

async def send_single_email(
    to_email: str,
    subject: str,
    html_body: str,
) -> dict:
    """Send a single email via Resend. Returns the Resend response."""
    _init_resend()

    try:
        response = await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            },
        )
        logger.info("📧 Email sent to %s: %s", to_email, subject)
        return response
    except Exception as e:
        logger.error("❌ Failed to send email to %s: %s", to_email, str(e))
        raise


async def send_to_segment(
    segment: str,
    email_type: str,
    db: AsyncSession,
    dry_run: bool = False,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
    highlight_feature: Optional[str] = None,
) -> dict:
    """Send emails to all users in a segment.

    Returns summary with sent_count, skipped_count, recipients.
    """
    users = await get_segment_users(segment, db)
    campaign_id = str(uuid.uuid4())[:8]

    sent_count = 0
    skipped_count = 0
    recipients = []

    for user in users:
        # Dedup check — skip if already received this type
        # For custom emails, use campaign-specific type to allow re-sends
        dedup_type = f"custom_{campaign_id}" if email_type == "custom" else email_type
        if email_type != "custom" and await has_already_received(user.id, email_type, db):
            skipped_count += 1
            continue

        # Generate email content based on type
        name = user.name or user.email.split("@")[0]
        subject, html_body = _render_email(
            email_type=email_type,
            name=name,
            credit_balance=user.credit_balance,
            user_id=user.id,
            db=db,
            custom_subject=custom_subject,
            custom_body=custom_body,
            highlight_feature=highlight_feature,
            email=user.email,
        )

        recipients.append({
            "email": user.email,
            "name": user.name,
            "subject": subject,
        })

        if not dry_run:
            try:
                await send_single_email(user.email, subject, html_body)
                await record_email_sent(user.id, dedup_type, subject, campaign_id, db)
                sent_count += 1
            except Exception:
                skipped_count += 1
        else:
            sent_count += 1  # In dry run, count as "would send"

    if not dry_run:
        await db.commit()

    return {
        "campaign_id": campaign_id,
        "segment": segment,
        "email_type": email_type,
        "sent_count": sent_count,
        "skipped_count": skipped_count,
        "total_in_segment": len(users),
        "dry_run": dry_run,
        "recipients": recipients,
    }


def _render_email(
    email_type: str,
    name: str,
    credit_balance: int,
    user_id,
    db: AsyncSession,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
    highlight_feature: Optional[str] = None,
    used_features: Optional[list[str]] = None,
    email: Optional[str] = None,
) -> tuple[str, str]:
    """Render email subject + HTML based on type."""
    if email_type == "onboarding_nudge":
        return email_templates.onboarding_nudge(name, credit_balance)
    elif email_type == "re_engagement":
        features = used_features or []
        return email_templates.re_engagement(name, credit_balance, features)
    elif email_type == "feedback_ask":
        return email_templates.feedback_ask(name)
    elif email_type == "credit_grant":
        return email_templates.credit_grant(name, credit_balance, highlight_feature)
    elif email_type == "custom":
        subj = custom_subject or "Update from Tarang"
        body = custom_body or "<p>Tarang update</p>"
        return email_templates.custom_email(
            name=name,
            credit_balance=credit_balance,
            subject=subj,
            body_text=body,
            email=email or "",
        )
    else:
        raise ValueError(f"Unknown email type: {email_type}")


async def send_to_segment_with_features(
    segment: str,
    email_type: str,
    db: AsyncSession,
    dry_run: bool = False,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
    highlight_feature: Optional[str] = None,
) -> dict:
    """Enhanced version that fetches used features per user for re-engagement."""
    users = await get_segment_users(segment, db)
    campaign_id = str(uuid.uuid4())[:8]

    sent_count = 0
    skipped_count = 0
    recipients = []

    for user in users:
        dedup_type = f"custom_{campaign_id}" if email_type == "custom" else email_type
        if email_type != "custom" and await has_already_received(user.id, email_type, db):
            skipped_count += 1
            continue

        name = user.name or user.email.split("@")[0]

        # Fetch used features for re-engagement emails
        used_features = []
        if email_type == "re_engagement":
            used_features = await get_used_features(user.id, db)

        subject, html_body = _render_email(
            email_type=email_type,
            name=name,
            credit_balance=user.credit_balance,
            user_id=user.id,
            db=db,
            custom_subject=custom_subject,
            custom_body=custom_body,
            highlight_feature=highlight_feature,
            used_features=used_features,
            email=user.email,
        )

        recipients.append({
            "email": user.email,
            "name": user.name,
            "subject": subject,
        })

        if not dry_run:
            try:
                await send_single_email(user.email, subject, html_body)
                await record_email_sent(user.id, dedup_type, subject, campaign_id, db)
                sent_count += 1
            except Exception:
                skipped_count += 1
        else:
            sent_count += 1

    if not dry_run:
        await db.commit()

    return {
        "campaign_id": campaign_id,
        "segment": segment,
        "email_type": email_type,
        "sent_count": sent_count,
        "skipped_count": skipped_count,
        "total_in_segment": len(users),
        "dry_run": dry_run,
        "recipients": recipients,
    }


# ── Email History ────────────────────────────────────────────────────────────

async def get_email_history(db: AsyncSession, limit: int = 50) -> list[dict]:
    """Get recent email campaigns grouped by campaign_id."""
    result = await db.execute(
        select(
            EmailEvent.campaign_id,
            EmailEvent.email_type,
            func.count().label("send_count"),
            func.min(EmailEvent.sent_at).label("sent_at"),
            func.min(EmailEvent.subject).label("subject"),
        )
        .group_by(EmailEvent.campaign_id, EmailEvent.email_type)
        .order_by(func.min(EmailEvent.sent_at).desc())
        .limit(limit)
    )

    return [
        {
            "campaign_id": row.campaign_id,
            "email_type": row.email_type,
            "send_count": row.send_count,
            "sent_at": row.sent_at.isoformat() if row.sent_at else None,
            "subject": row.subject,
        }
        for row in result.all()
    ]


# ── Resend Audience Sync ─────────────────────────────────────────────────────

AUDIENCE_NAME = "Tarang Active Users"


async def sync_audience_to_resend(db: AsyncSession) -> dict:
    """Sync all active users to a Resend Audience for direct broadcasting.

    Creates the audience if it doesn't exist, then upserts all active users
    as contacts. This lets you send broadcasts directly from resend.com/audiences.
    """
    _init_resend()

    # Get or create the audience
    audience_id = None
    try:
        audiences = resend.Audiences.list()
        existing = [a for a in (audiences.data if hasattr(audiences, 'data') else audiences.get("data", [])) if a.get("name") == AUDIENCE_NAME or getattr(a, "name", None) == AUDIENCE_NAME]
        if existing:
            audience_id = existing[0].get("id") or getattr(existing[0], "id", None)
    except Exception as e:
        logger.warning("Could not list audiences: %s", e)

    if not audience_id:
        try:
            result = resend.Audiences.create({"name": AUDIENCE_NAME})
            audience_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
            logger.info("📋 Created Resend audience: %s (id=%s)", AUDIENCE_NAME, audience_id)
        except Exception as e:
            logger.error("❌ Failed to create audience: %s", e)
            raise

    # Get all active users
    result = await db.execute(
        select(User).where(User.credit_limit > 0).order_by(User.created_at.asc())
    )
    users = list(result.scalars().all())

    synced = 0
    errors = 0
    for user in users:
        name = user.name or user.email.split("@")[0]
        first_name = name.split()[0] if name else ""
        last_name = " ".join(name.split()[1:]) if name and len(name.split()) > 1 else ""

        try:
            resend.Contacts.create(
                audience_id=audience_id,
                params={
                    "email": user.email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "unsubscribed": False,
                },
            )
            synced += 1
        except Exception as e:
            logger.warning("Failed to sync contact %s: %s", user.email, e)
            errors += 1

    logger.info("📋 Synced %d contacts to Resend audience (errors: %d)", synced, errors)

    return {
        "audience_id": audience_id,
        "audience_name": AUDIENCE_NAME,
        "synced": synced,
        "errors": errors,
        "total_users": len(users),
    }

