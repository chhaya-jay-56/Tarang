# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Admin-only email endpoints — kept separate from admin.py to avoid bloating
# that file (already 541 lines). Same auth protection via get_admin_user().
#
# ENDPOINTS:
#   GET  /api/admin/email/segments  — segment user counts
#   POST /api/admin/email/preview   — preview an email for a single user
#   POST /api/admin/email/send      — send to a segment (or dry run)
#   GET  /api/admin/email/history   — past campaigns with send counts
# ─────────────────────────────────────────────────────────────────────────────

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.user import User
from app.utils.admin_auth import get_admin_user
from app.services import email_service

logger = logging.getLogger("tarang.email_admin")

router = APIRouter(prefix="/api/admin/email", tags=["admin-email"])


# ── Request/Response schemas ─────────────────────────────────────────────────

class EmailSendRequest(BaseModel):
    segment: str  # "never_used", "used_once", "all"
    email_type: str  # "onboarding_nudge", "re_engagement", "feedback_ask", "credit_grant", "custom"
    subject: Optional[str] = None  # required for "custom"
    body: Optional[str] = None  # required for "custom"
    highlight_feature: Optional[str] = None  # optional for "credit_grant"
    dry_run: bool = False
    send_test_to: Optional[str] = None  # optional address to receive 1 real test email during dry run


class EmailPreviewRequest(BaseModel):
    email_type: str
    user_id: Optional[str] = None  # preview for specific user, or use first in segment
    subject: Optional[str] = None
    body: Optional[str] = None
    highlight_feature: Optional[str] = None


class EmailSendTestRequest(BaseModel):
    to_email: str
    email_type: str = "custom"
    subject: Optional[str] = None
    body: Optional[str] = None
    highlight_feature: Optional[str] = None


# ── Segments ─────────────────────────────────────────────────────────────────

@router.get("/segments")
async def get_segments(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user counts for each email segment."""
    counts = await email_service.get_segment_counts(db)

    # Also get list of users per segment for the UI
    segments = {}
    for seg_name in ["never_used", "used_once", "all"]:
        users = await email_service.get_segment_users(seg_name, db)
        segments[seg_name] = {
            "count": counts[seg_name],
            "users": [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "name": u.name,
                    "credit_balance": u.credit_balance,
                    "credit_limit": u.credit_limit,
                }
                for u in users[:20]  # Cap at 20 for preview
            ],
        }

    return {"segments": segments}


# ── Preview ──────────────────────────────────────────────────────────────────

@router.post("/preview")
async def preview_email(
    body: EmailPreviewRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview how an email would look for a specific user."""
    # Get a user to preview with
    if body.user_id:
        result = await db.execute(select(User).where(User.id == body.user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        # Use the admin user themselves for preview
        user = admin

    name = user.name or (user.email.split("@")[0] if user.email else "Jay")
    credits = user.credit_balance if user.credit_balance is not None else 100

    # Get used features for re-engagement preview
    used_features = []
    if body.email_type == "re_engagement":
        used_features = await email_service.get_used_features(user.id, db)

    subject, html_body = email_service._render_email(
        email_type=body.email_type,
        name=name,
        credit_balance=credits,
        user_id=user.id,
        db=db,
        custom_subject=body.subject or "Tarang Preview",
        custom_body=body.body or "<p>Preview content</p>",
        highlight_feature=body.highlight_feature,
        used_features=used_features,
        email=user.email or "jaychhaya3489@gmail.com",
    )

    return {
        "subject": subject,
        "html": html_body,
        "preview_user": {
            "email": user.email,
            "name": user.name,
        },
    }


# ── Send Test ────────────────────────────────────────────────────────────────

@router.post("/send-test")
async def send_test_email(
    body: EmailSendTestRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a real test email to verify rendering and inbox deliverability."""
    if not body.to_email:
        raise HTTPException(status_code=400, detail="Recipient email address is required")

    name = admin.name or (admin.email.split("@")[0] if admin.email else "Jay")
    credits = admin.credit_balance if admin.credit_balance is not None else 100

    subject, html_body = email_service._render_email(
        email_type=body.email_type,
        name=name,
        credit_balance=credits,
        user_id=admin.id,
        db=db,
        custom_subject=body.subject or "Tarang Preview Test",
        custom_body=body.body or "<p>Test email from Tarang Admin.</p>",
        highlight_feature=body.highlight_feature,
        email=body.to_email,
    )

    test_subject = subject if subject.startswith("[TEST]") else f"[TEST] {subject}"

    try:
        response = await email_service.send_single_email(
            to_email=body.to_email,
            subject=test_subject,
            html_body=html_body,
        )
        logger.info("🧪 Test email sent to %s: %s", body.to_email, test_subject)
        return {
            "success": True,
            "to_email": body.to_email,
            "subject": test_subject,
            "message": f"Test email sent to {body.to_email}",
            "resend_response": response,
        }
    except Exception as e:
        logger.error("❌ Failed to send test email to %s: %s", body.to_email, str(e))
        raise HTTPException(status_code=500, detail=f"Resend error: {str(e)}")


# ── Send ─────────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_emails(
    body: EmailSendRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send emails to a segment. Supports dry_run to preview recipients and test send."""
    # Validate segment
    if body.segment not in ("never_used", "used_once", "all"):
        raise HTTPException(status_code=400, detail="Invalid segment")

    # Validate email type
    valid_types = ("onboarding_nudge", "re_engagement", "feedback_ask", "credit_grant", "custom")
    if body.email_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid email_type. Must be one of: {valid_types}")

    # Custom emails require subject and body
    if body.email_type == "custom" and (not body.subject or not body.body):
        raise HTTPException(status_code=400, detail="Custom emails require subject and body")

    logger.info(
        "📧 Admin email %s: segment=%s, type=%s, dry_run=%s, test_to=%s, by=%s",
        "dry run" if body.dry_run else "send",
        body.segment, body.email_type, body.dry_run, body.send_test_to, admin.clerk_user_id,
    )

    result = await email_service.send_to_segment_with_features(
        segment=body.segment,
        email_type=body.email_type,
        db=db,
        dry_run=body.dry_run,
        custom_subject=body.subject,
        custom_body=body.body,
        highlight_feature=body.highlight_feature,
    )

    # If dry run and send_test_to requested, send 1 test email to verify
    test_result = None
    if body.dry_run and body.send_test_to:
        try:
            name = admin.name or (admin.email.split("@")[0] if admin.email else "Jay")
            credits = admin.credit_balance if admin.credit_balance is not None else 100
            test_subj, test_html = email_service._render_email(
                email_type=body.email_type,
                name=name,
                credit_balance=credits,
                user_id=admin.id,
                db=db,
                custom_subject=body.subject or "Tarang Preview Test",
                custom_body=body.body or "<p>Test email</p>",
                highlight_feature=body.highlight_feature,
                email=body.send_test_to,
            )
            test_subject = test_subj if test_subj.startswith("[TEST]") else f"[TEST] {test_subj}"
            await email_service.send_single_email(
                to_email=body.send_test_to,
                subject=test_subject,
                html_body=test_html,
            )
            test_result = {"sent": True, "to": body.send_test_to, "subject": test_subject}
        except Exception as e:
            logger.error("❌ Dry run test send to %s failed: %s", body.send_test_to, str(e))
            test_result = {"sent": False, "to": body.send_test_to, "error": str(e)}

    result["test_email"] = test_result
    return result


# ── History ──────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_email_history(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get past email campaigns with send counts."""
    history = await email_service.get_email_history(db)
    return {"history": history}


# ── Resend Audience Sync ────────────────────────────────────────────────────

@router.post("/sync-audience")
async def sync_audience(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync all active users to a Resend Audience.

    This creates/updates a contact list on Resend so you can:
    - Send broadcasts directly from resend.com/audiences
    - Track open rates, click rates per email
    - Manage unsubscribes from the Resend dashboard
    """
    logger.info("📋 Audience sync triggered by admin: %s", admin.clerk_user_id)

    try:
        result = await email_service.sync_audience_to_resend(db)
        return result
    except Exception as e:
        logger.error("❌ Audience sync failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Audience sync failed: {str(e)}")

