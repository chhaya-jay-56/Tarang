# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Persistent asset library — stores voice samples, instrumentals, and
# reference videos that users keep permanently. Unlike uploaded_videos
# (which expire), these assets are the user's long-term collection.
#
# CONCEPT: Asset Library (from final_schema_review.md §3)
#   A user can upload a voice sample, use it for multiple clone jobs and
#   dub jobs over weeks/months. The file lives in R2 permanently; this
#   table tracks the metadata.
#
# WHY separate from uploaded_videos:
#   uploaded_videos are EPHEMERAL (TTL ~1 day, auto-cleanup).
#   user_assets are PERMANENT (no expiry). Mixing them would mean the
#   cleanup worker needs complex WHERE clauses to avoid deleting assets.
#
# WHY separate from clone_jobs:
#   user_assets stores the FILE (what was uploaded).
#   clone_jobs stores the JOB STATE (queued/processing/succeeded/failed).
#   This is the SRP (Single Responsibility Principle) — the file metadata
#   doesn't change when a clone job fails and retries.
#
# WHY ENUM for asset_type:
#   The types are a closed set: voice_sample, instrumental, reference_video.
#   ENUM makes queries like "all voice samples for user X" use the index
#   efficiently (vs TEXT which would need a functional index).
#
# FLOW CONNECTION:
#   User uploads voice → creates UserAsset → CloneJob.voice_asset_id FK here
#   User uploads instrumental → creates UserAsset → DubJob.voice_asset_id FK
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


class AssetType(enum.Enum):
    """Types of persistent assets a user can store.

    WHY these specific types:
      voice_sample    → reference audio for voice cloning (the "source voice")
      instrumental    → background music/audio to mix into final dub
      reference_video → a video the user keeps as a template or reference
    """
    voice_sample = "voice_sample"
    instrumental = "instrumental"
    reference_video = "reference_video"


class UserAsset(Base):
    """
    Persistent asset library — voice samples, instrumentals, reference videos.

    Files are stored in R2; only the metadata + R2 key is tracked here.
    UNIQUE constraint on r2_key prevents duplicate storage entries.
    """

    __tablename__ = "user_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id — CASCADE: delete user → delete all their assets
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Asset type ENUM
    asset_type = Column(
        Enum(AssetType, name="asset_type", create_type=False),
        nullable=False,
    )

    # ── R2 key — UNIQUE prevents duplicate entries pointing to same file
    r2_key = Column(Text, nullable=False, unique=True)

    file_name = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)

    # ── Duration in ms — relevant for voice samples and reference videos
    duration_ms = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    user = relationship("User", back_populates="user_assets")
    # WHY RESTRICT on clone_jobs: Can't delete an asset that's actively being
    # used in a clone job — that would break the job's reference to the voice
    clone_jobs = relationship("CloneJob", back_populates="voice_asset")

    def __repr__(self):
        return f"<UserAsset {self.asset_type.value} {self.file_name}>"
