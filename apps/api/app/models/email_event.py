# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Tracks every email sent to prevent double-sends and provide send history.
# Before sending any email, the service checks: "has this user already
# received this email_type?" If yes, skip. This is the dedup guard.
#
# WHY a separate table (not a flag on users):
#   Users can receive multiple email TYPES (onboarding, re-engagement,
#   feedback, custom broadcasts). A flag per type on users would bloat
#   the users table. This is a proper event log — one row per send.
#
# FLOW: email_service.py → check email_events → if not sent → send → INSERT
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import Column, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EmailEvent(Base):
    """Tracks every email sent to a user for dedup and history."""

    __tablename__ = "email_events"

    __table_args__ = (
        # Fast lookup: "has this user already received this email type?"
        Index("ix_email_events_user_type", "user_id", "email_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users — CASCADE: if user deleted, their email history goes too
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ── What type of email was sent
    # Values: "onboarding_nudge", "re_engagement", "feedback_ask",
    #         "credit_grant", "custom_<campaign_id>"
    email_type = Column(Text, nullable=False)

    # ── For broadcasts: groups related sends under one campaign
    campaign_id = Column(Text, nullable=True)

    # ── Subject line sent (for history display)
    subject = Column(Text, nullable=True)

    sent_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships
    user = relationship("User", backref="email_events")

    def __repr__(self):
        return f"<EmailEvent {self.email_type} to user={self.user_id}>"
