# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# The "spine" table of the video dubbing pipeline. Every dubbing job
# (upload video → transcribe → translate → clone voices → assemble) is
# tracked as a single row here. The status ENUM drives the pipeline —
# not separate phase tables.
#
# CONCEPT: Pipeline Spine Table (from final_schema_review.md §5)
#   Instead of having separate "transcription_jobs" and "assembly_jobs"
#   tables, we use ONE dub_jobs row with a status ENUM that progresses:
#   queued → transcribing → translating → cloning → assembling → completed
#   This is simpler to query and debug ("show me all failed jobs").
#
# WHY ON DELETE RESTRICT for user_id:
#   If a user has active dub jobs (especially with credits deducted),
#   we CANNOT delete the user — that would orphan financial records.
#   The app layer must cancel/refund active jobs before allowing deletion.
#
# WHY ON DELETE SET NULL for uploaded_video_id and voice_asset_id:
#   The source video expires after TTL (uploaded_videos auto-cleanup).
#   The voice asset might be deleted by the user later. In both cases,
#   the dub job record should SURVIVE — it's historical data + audit trail.
#   SET NULL preserves the job record while acknowledging the source is gone.
#
# FLOW CONNECTION:
#   User starts dubbing → creates DubJob (queued) →
#   Worker: transcribes → creates TranscriptionSegments →
#   Worker: translates → updates TranscriptionSegments.translated_text →
#   Worker: clones → creates DubSegments (one per TranscriptionSegment) →
#   Worker: assembles → creates FinalDub → DubJob.status = completed
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Text, Integer, Boolean, DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DubJobStatus(enum.Enum):
    """State machine for the dubbing pipeline.

    WHY these specific states (ordered by pipeline phase):
      queued       → waiting for worker to pick up
      transcribing → Phase 1: extracting speech from video via Whisper
      translating  → Phase 2: translating transcript to target language
      cloning      → Phase 3: generating cloned voice audio for each segment
      assembling   → Phase 4: mixing cloned audio back into the video
      completed    → done — final dubbed video available in R2
      failed       → pipeline broke at some phase (see failure_reason)
    """
    queued = "queued"
    transcribing = "transcribing"
    translating = "translating"
    cloning = "cloning"
    assembling = "assembling"
    completed = "completed"
    failed = "failed"


class DubJob(Base):
    """
    Video dubbing pipeline spine — one row per dubbing job.

    Status ENUM drives the multi-phase pipeline. Child tables:
      - transcription_segments (Phase 1+2 output)
      - dub_segments (Phase 3 output, via transcription_segments)
      - final_dubs (Phase 4 output, 1:1)
    """

    __tablename__ = "dub_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── RESTRICT: can't delete user with active dub jobs
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ── SET NULL: source video may expire via TTL cleanup
    uploaded_video_id = Column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_videos.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── SET NULL: user might delete the voice asset after dubbing
    voice_asset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_assets.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Languages ──
    source_language = Column(Text, nullable=False)
    target_language = Column(Text, nullable=False)

    # ── Provider-agnostic (for the cloning phase of dubbing) ──
    # WHY at job level: The dub job knows which provider/model to use for
    # ALL segments. Individual dub_segments inherit this or can override.
    provider = Column(Text, nullable=True)
    model_name = Column(Text, nullable=True)

    # ── Status ──
    status = Column(
        Enum(DubJobStatus, name="dub_job_status", create_type=False),
        nullable=False,
        server_default="queued",
    )
    # Verbose failure reason — NULL unless status=failed
    failure_reason = Column(Text, nullable=True)

    # ── Credits ──
    credit_cost = Column(Integer, nullable=True)
    credits_deducted = Column(Boolean, nullable=False, server_default="false")

    # ── Timestamps ──
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ──
    user = relationship("User", back_populates="dub_jobs")
    uploaded_video = relationship("UploadedVideo", back_populates="dub_jobs")
    transcription_segments = relationship(
        "TranscriptionSegment", back_populates="dub_job", cascade="all, delete-orphan"
    )
    final_dub = relationship(
        "FinalDub", back_populates="dub_job", uselist=False, cascade="all, delete-orphan"
    )
    credit_transactions = relationship("CreditTransaction", back_populates="dub_job")
    history_entries = relationship("History", back_populates="dub_job")

    def __repr__(self):
        return f"<DubJob {self.id} {self.source_language}→{self.target_language} status={self.status}>"
