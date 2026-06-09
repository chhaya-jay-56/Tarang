# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores user-created custom voices — reference audio uploaded by users or
# saved from completed clone jobs. Always has a user_id.
#
# SPLIT FROM: saved_voices (which mixed presets + custom in one table)
# WHY SPLIT:
#   Separating custom voices from presets allows a COMPOSITE UNIQUE
#   constraint on (user_id, r2_key) instead of a GLOBAL unique on r2_key.
#   This prevents the r2_key collision bug that broke 2nd TTS generations.
#
# CONCEPT: User Voice Library
#   Users upload reference audio → stored on R2 → reused across clone
#   jobs and TTS generation without re-uploading.
#
# WHY source_type:
#   Tracks HOW the voice was created:
#     "upload"    → user uploaded raw reference audio
#     "clone_job" → saved from a completed clone job's output
#   This helps the UI show provenance and the system manage R2 cleanup.
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import (
    Column, Text, Integer, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CustomVoice(Base):
    """User-created custom voice — reference audio for TTS and cloning.

    Always belongs to a user. Uses composite unique (user_id, r2_key)
    to prevent collisions without a global unique constraint.
    """

    __tablename__ = "custom_voices"

    __table_args__ = (
        # Composite unique: same user can't have duplicate r2_keys,
        # but different users CAN (e.g., if both save from same preset)
        UniqueConstraint("user_id", "r2_key", name="uq_custom_voice_user_r2_key"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id — CASCADE: delete user → delete all their voices
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Voice metadata
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    # ── R2 key for the reference audio file
    r2_key = Column(Text, nullable=False)

    # ── Language of the voice (ISO 639-1 code)
    language = Column(Text, nullable=False, server_default="en")

    # ── Audio duration in milliseconds
    duration_ms = Column(Integer, nullable=True)

    # ── How the voice was created
    source_type = Column(Text, nullable=False, server_default="upload")

    # ── FK to clone_jobs.id — if voice was saved from a clone job
    source_clone_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clone_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Flexible metadata (model used, source info, etc.)
    metadata_ = Column("metadata", JSONB, nullable=True)

    # ── Timestamps
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships
    user = relationship("User", back_populates="custom_voices")
    source_clone_job = relationship("CloneJob", foreign_keys=[source_clone_job_id])

    def __repr__(self):
        return f"<CustomVoice {self.name} user={self.user_id}>"
