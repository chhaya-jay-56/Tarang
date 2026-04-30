# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores Phase 1+2 output of the dubbing pipeline: timestamps, original
# transcript text, and translated text for each spoken segment in a video.
#
# CONCEPT: Speech Segments (from tarang-db-schema.md §5)
#   Whisper (or similar ASR) splits audio into segments with timestamps.
#   Each segment = one chunk of speech (e.g. one sentence). This table
#   stores: when it was spoken (start_sec, end_sec), what was said
#   (original_text), and the translation (translated_text).
#
# WHY segment_index instead of ordering by start_sec:
#   Whisper segments can occasionally overlap or have identical start times.
#   An explicit index guarantees deterministic ordering during assembly.
#   UNIQUE(dub_job_id, segment_index) prevents duplicate segment numbers.
#
# WHY DOUBLE PRECISION for start_sec/end_sec (not INTEGER ms):
#   Whisper API returns timestamps as float seconds (3.608, 5.229).
#   Converting to ms would lose the Whisper-native format and require
#   conversions in every query. We store what Whisper gives us.
#
# WHY CHECK constraints:
#   - chk_segment_index_positive: No negative indices
#   - chk_segment_timing: start must be >= 0 and end must be > start
#     (catches data corruption from buggy ASR output)
#
# FLOW CONNECTION:
#   DubJob (transcribing) → Whisper → creates TranscriptionSegment rows →
#   DubJob (translating) → updates translated_text →
#   DubJob (cloning) → creates one DubSegment per TranscriptionSegment
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import (
    Column, Text, Integer, Float, DateTime, ForeignKey,
    UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class TranscriptionSegment(Base):
    """
    Phase 1+2 output — one row per spoken segment in a video.

    Stores timestamps (from Whisper), original text, and translated text.
    Each segment gets exactly one DubSegment (1:1) for the cloned audio.
    """

    __tablename__ = "transcription_segments"

    # ── Table-level constraints ──
    # WHY in __table_args__: SQLAlchemy requires multi-column constraints
    # (like UNIQUE on two columns) to be defined at the table level
    __table_args__ = (
        UniqueConstraint("dub_job_id", "segment_index", name="uq_ts_job_segment"),
        CheckConstraint("segment_index >= 0", name="chk_segment_index_positive"),
        CheckConstraint(
            "start_sec >= 0 AND end_sec > start_sec",
            name="chk_segment_timing",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to dub_jobs — CASCADE: delete the job → delete all segments
    dub_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("dub_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Ordering within the job (0-indexed)
    segment_index = Column(Integer, nullable=False)

    # ── Timestamps from Whisper (seconds, float)
    start_sec = Column(Float, nullable=False)
    end_sec = Column(Float, nullable=False)

    # ── Text content ──
    # original_text: what was spoken (Whisper output)
    # translated_text: translation (filled in Phase 2)
    # WHY both nullable: Phase 1 creates the row with original_text,
    # Phase 2 fills in translated_text. If ASR fails on a segment,
    # original_text might be NULL.
    original_text = Column(Text, nullable=True)
    translated_text = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    dub_job = relationship("DubJob", back_populates="transcription_segments")
    # 1:1 with dub_segment (UNIQUE FK on dub_segments.transcription_segment_id)
    dub_segment = relationship(
        "DubSegment", back_populates="transcription_segment",
        uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<TranscriptionSegment job={self.dub_job_id} idx={self.segment_index}>"
