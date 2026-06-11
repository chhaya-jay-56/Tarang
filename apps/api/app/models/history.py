# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Flexible action log for the UI history tab. Tracks user actions like
# "uploaded voice", "clone started", "dub completed" with JSON metadata.
#
# CONCEPT: Event Log (from final_schema_review.md §10)
#   credit_transactions only tracks credits. This table tracks ALL user
#   actions (uploads, clones, dubs) with flexible JSONB metadata.
#   The frontend history tab queries this table.
#
# WHY kept from existing code: The frontend already has a history tab
#   that reads from this table. Dropping it would break the UI.
#
# KEY CHANGE from old version:
#   - FK changed from clerk_user_id → user_id (UUID surrogate key)
#   - Added clone_job_id and dub_job_id FKs for linking to specific jobs
#   - Removed voice_id FK (voices table dropped, replaced by clone_jobs)
#
# FLOW: Any user action → INSERT history row → frontend polls/queries
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import Column, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class History(Base):
    """
    Flexible action log for UI history tab.

    Each entry records what happened (action) with flexible JSONB metadata.
    Examples:
        action="uploaded",        metadata={"filename": "sample.wav"}
        action="clone_started",   metadata={"provider": "modal", "model": "omnivoice"}
        action="dub_completed",   metadata={"target_language": "hi"}
    """

    __tablename__ = "history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id (UUID) — CASCADE: delete user → delete history
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ── Optional FK to clone job — SET NULL if job deleted
    clone_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clone_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Action type (free-form TEXT, not ENUM — too many possible actions)
    action = Column(Text, nullable=False)

    # ── Flexible payload — JSONB for arbitrary action-specific data
    # WHY JSONB not JSON: JSONB is indexed, queryable, and faster for reads
    metadata_ = Column("metadata", JSONB, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    user = relationship("User", back_populates="history")
    clone_job = relationship("CloneJob", back_populates="history_entries")

    def __repr__(self):
        return f"<History {self.action}>"
