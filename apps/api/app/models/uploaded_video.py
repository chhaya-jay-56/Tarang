# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Tracks ephemeral video uploads. When a user uploads a video for dubbing,
# it lands here with a TTL (~1 day via `expires_at`). A background cleanup
# job deletes expired uploads from both R2 storage and this table.
#
# CONCEPT: Ephemeral Storage with TTL (from tarang-db-schema.md §2)
#   Videos are large (hundreds of MB). We don't keep them forever — once
#   the dubbing job finishes (or the user abandons it), the raw upload is
#   cleaned up. `expires_at` drives the cleanup worker.
#
# WHY a separate table (not user_assets):
#   `user_assets` is for PERMANENT files (voice samples, instrumentals).
#   Uploads are TEMPORARY — mixing them would complicate the cleanup query
#   and risk accidentally deleting permanent assets.
#
# WHY PostgreSQL ENUM for status:
#   The status values are a CLOSED set that maps to a state machine:
#   uploaded → processing → processed → expired
#   ENUM enforces this at DB level. Unlike TEXT + CHECK, ENUM shows up in
#   pg_type and is self-documenting in schema introspection tools.
#
# FLOW CONNECTION:
#   Frontend uploads video → API creates UploadedVideo row →
#   dub_jobs.uploaded_video_id FK points here → cleanup job expires old rows
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Text, BigInteger, Integer, DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class UploadedVideoStatus(enum.Enum):
    """State machine for video upload lifecycle.

    WHY these specific states:
      uploaded   → file received, not yet analyzed
      processing → extracting duration, validating format
      processed  → ready to be used in a dub_job
      expired    → past TTL, scheduled for R2 deletion
    """
    uploaded = "uploaded"
    processing = "processing"
    processed = "processed"
    expired = "expired"


class UploadedVideo(Base):
    """
    Ephemeral video uploads — auto-expire after ~1 day.

    Linked to dub_jobs as the source video for dubbing.
    Cleanup worker queries: WHERE expires_at < NOW() AND status != 'expired'
    """

    __tablename__ = "uploaded_videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id (UUID) — CASCADE: delete user → delete their uploads
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── R2 object key (e.g. "uploads/user-uuid/video-uuid.mp4")
    r2_key = Column(Text, nullable=False)

    # ── User-facing filename for display (e.g. "my_video.mp4")
    file_name = Column(Text, nullable=True)

    # ── File size in bytes — BIGINT because videos can exceed 2GB (INT max)
    file_size = Column(BigInteger, nullable=True)

    # ── Video duration in milliseconds — needed for credit cost calculation
    # WHY ms not seconds: Avoids floating point (3608ms vs 3.608s)
    duration_ms = Column(Integer, nullable=True)

    # ── Status ENUM — see UploadedVideoStatus docstring for state machine
    status = Column(
        Enum(UploadedVideoStatus, name="uploaded_video_status", create_type=False),
        nullable=False,
        server_default="uploaded",
    )

    # ── TTL expiry — set to NOW() + INTERVAL '1 day' at INSERT time
    # The cleanup worker queries: WHERE expires_at < NOW() AND status != 'expired'
    expires_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    user = relationship("User", back_populates="uploaded_videos")
    # WHY no back_populates from dub_jobs: dub_jobs has uploaded_video_id FK
    # but it's SET NULL on delete — the relationship is defined on DubJob side
    dub_jobs = relationship("DubJob", back_populates="uploaded_video")

    def __repr__(self):
        return f"<UploadedVideo {self.file_name} status={self.status}>"
