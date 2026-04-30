# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores Phase 4 output: the fully assembled dubbed video. One row per
# completed dub job (1:1 relationship enforced by UNIQUE on dub_job_id).
#
# CONCEPT: Final Output Table (from tarang-db-schema.md §7)
#   After all segments are cloned and mixed back into the original video,
#   the final file is stored in R2. This table tracks which R2 key holds
#   the output for which dub job.
#
# WHY a separate table (not a column on dub_jobs):
#   - Not all dub jobs produce a final video (failed jobs don't)
#   - The final video has its own metadata (file_size, r2_key)
#   - Keeping it separate means dub_jobs stays a lightweight spine table
#   - 1:1 is enforced by UNIQUE, so there's no redundancy concern
#
# WHY UNIQUE on both dub_job_id and r2_key:
#   - dub_job_id UNIQUE: one final video per job (no duplicates)
#   - r2_key UNIQUE: no two records point to the same R2 file
#     (prevents orphaned storage if someone re-runs assembly)
#
# FLOW CONNECTION:
#   DubJob (assembling) → FFmpeg mixes segments into video →
#   uploads to R2 → creates FinalDub row → DubJob.status = completed
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import Column, Text, BigInteger, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class FinalDub(Base):
    """
    Phase 4 output — assembled final dubbed video.

    1:1 with dub_jobs (UNIQUE FK). Created only when assembly succeeds.
    """

    __tablename__ = "final_dubs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── 1:1 FK to dub_jobs — UNIQUE enforces one final video per job
    # CASCADE: delete the job → delete the final dub record
    dub_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("dub_jobs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ── R2 key — UNIQUE prevents duplicate storage entries
    r2_key = Column(Text, nullable=False, unique=True)

    # ── File size in bytes — BIGINT because dubbed videos can be large
    file_size = Column(BigInteger, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    dub_job = relationship("DubJob", back_populates="final_dub")

    def __repr__(self):
        return f"<FinalDub job={self.dub_job_id}>"
