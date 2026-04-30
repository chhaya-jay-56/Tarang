# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores Phase 3 output of the dubbing pipeline: one cloned audio file
# per transcription segment. Each dub_segment is a voice-cloned rendering
# of one translated text segment.
#
# CONCEPT: Per-Segment Cloning (from final_schema_review.md §7)
#   The dubbing pipeline doesn't clone the entire video at once. It clones
#   each transcript segment individually, then assembles them. This allows:
#   - Parallel processing (clone 10 segments simultaneously)
#   - Partial retry (if segment 7 fails, only re-clone segment 7)
#   - Progress tracking (12/20 segments done = 60% progress)
#
# WHY 1:1 with transcription_segments (not many-to-one):
#   Each transcript segment produces exactly ONE cloned audio. If we need
#   retries, we UPDATE the existing dub_segment row (not create a new one).
#   UNIQUE constraint on transcription_segment_id enforces this.
#
# WHY provider-agnostic columns here too (not just on dub_jobs):
#   In theory, different segments could use different providers (e.g. if
#   one provider fails, retry with another). In practice, they usually all
#   use the same provider — but the columns are here for flexibility.
#
# WHY no dub_job_id FK (denormalized):
#   The old schema had a direct FK from dub_segments → dub_jobs. This was
#   denormalized because you can derive it: dub_segment → transcription_segment
#   → dub_job. Removing it avoids dual-FK consistency issues.
#
# FLOW CONNECTION:
#   DubJob (cloning phase) → for each TranscriptionSegment:
#     create DubSegment (pending) → call provider API → update status/r2_key
#   DubJob (assembling phase) → query all DubSegments WHERE status=completed
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Text, Integer, DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DubSegmentStatus(enum.Enum):
    """State machine for individual segment cloning.

    WHY these specific states:
      pending    → waiting for cloning worker
      processing → provider API call in progress
      completed  → cloned audio stored in R2
      failed     → cloning failed for this segment (can retry)
    """
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class DubSegment(Base):
    """
    Phase 3 output — one cloned audio segment per transcription segment.

    1:1 with transcription_segments (enforced by UNIQUE FK).
    Provider-agnostic: stores which provider/model was used per segment.
    """

    __tablename__ = "dub_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── 1:1 FK to transcription_segments — UNIQUE enforces one-to-one
    # CASCADE: delete the transcript segment → delete the cloned audio entry
    transcription_segment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transcription_segments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ── Provider-agnostic job tracking ──
    # WHY TEXT not ENUM: providers are dynamic — new ones added at app layer
    provider = Column(Text, nullable=True)         # "replicate" | "modal" | "runpod"
    model_name = Column(Text, nullable=True)       # "indextts-2" | "omnivoice"
    external_job_id = Column(Text, nullable=True)  # provider's prediction/call ID
    provider_meta = Column(JSONB, nullable=True)   # provider-specific extras

    # ── Output ──
    # R2 key for the cloned .wav file
    r2_key = Column(Text, nullable=True)
    # Duration of the cloned audio in milliseconds
    duration_ms = Column(Integer, nullable=True)

    # ── Status ──
    status = Column(
        Enum(DubSegmentStatus, name="dub_segment_status", create_type=False),
        nullable=False,
        server_default="pending",
    )

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    transcription_segment = relationship(
        "TranscriptionSegment", back_populates="dub_segment"
    )

    def __repr__(self):
        return f"<DubSegment ts={self.transcription_segment_id} status={self.status}>"
