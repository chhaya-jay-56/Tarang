# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Tracks standalone voice cloning jobs. This is the ⭐ KEY TABLE for
# model-agnosticism — it replaces the old `voices` table which was
# hardwired to Replicate + IndexTTS-2.
#
# CONCEPT: Provider-Agnostic Job Tracking (from final_schema_review.md §4)
#   The DB stores WHAT happened (a cloning job was requested, it
#   succeeded/failed, here's the output). It does NOT care HOW it happened
#   (which API, model, or cloud provider). This means swapping from
#   IndexTTS-2/Replicate → OmniVoice/Modal requires ZERO DB migrations.
#
# WHY this replaced `voices`:
#   The old `voices` table mixed file storage (original_file_url, cloned_file_url)
#   with job state (status, clone_stage, error_message). That violated SRP:
#   - File storage → now in `user_assets` (persistent asset library)
#   - Job state → now in `clone_jobs` (this table)
#
# WHY provider/model_name/external_job_id instead of replicate_prediction_id:
#   `replicate_prediction_id` is tied to ONE provider. If you switch to Modal,
#   you'd need a migration to add `modal_call_id`. The generic columns work
#   with ANY provider — just store different values:
#     Replicate: provider="replicate", external_job_id="pred_abc123"
#     Modal:     provider="modal",     external_job_id="call-xyz789"
#     RunPod:    provider="runpod",    external_job_id="run-456"
#
# WHY provider_meta is JSONB:
#   Each provider has unique metadata (Replicate has version hashes, Modal
#   has endpoint URLs, RunPod has GPU types). JSONB stores any structure
#   without needing columns for every provider's quirks.
#
# FLOW CONNECTION:
#   User clicks "Clone Voice" → API creates CloneJob (status=queued) →
#   Worker picks up job → calls provider API → updates status + output →
#   Credits deducted on success → History entry created
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Text, Integer, Boolean, DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CloneJobStatus(enum.Enum):
    """State machine for voice cloning jobs.

    WHY these specific states:
      queued     → job created, waiting for worker
      processing → worker picked it up, calling provider API
      succeeded  → cloning complete, output stored in R2
      failed     → something went wrong (see error_message)
    """
    queued = "queued"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"


class CloneJob(Base):
    """
    Voice cloning job tracker — model-agnostic design.

    Replaces the old `voices` table. Separates job state from file storage.
    Provider columns (provider, model_name, external_job_id, provider_meta)
    make it possible to switch cloning providers without DB migrations.
    """

    __tablename__ = "clone_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id — CASCADE: delete user → delete their clone jobs
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── FK to user_assets.id — RESTRICT: can't delete the voice asset
    # while a clone job references it (the job needs the source audio)
    voice_asset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_assets.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # ── Input ──
    # The text to synthesize using the cloned voice
    input_text = Column(Text, nullable=False)
    # Optional language hint (e.g. "en", "hi") — some models need this
    source_language = Column(Text, nullable=True)
    # Target output language — the language the cloned voice should speak
    target_language = Column(Text, nullable=True)

    # ── Provider-agnostic job tracking ──
    # WHY TEXT not ENUM: providers can be added/removed without migrations
    provider = Column(Text, nullable=False)       # "replicate" | "modal" | "runpod"
    model_name = Column(Text, nullable=False)     # "indextts-2" | "omnivoice"
    external_job_id = Column(Text, nullable=True)  # provider's job/prediction/call ID
    # WHY JSONB: each provider has unique metadata structures
    provider_meta = Column(JSONB, nullable=True)   # {version, endpoint, gpu_type, ...}

    # ── Status ──
    status = Column(
        Enum(CloneJobStatus, name="clone_job_status", create_type=False),
        nullable=False,
        server_default="queued",
    )
    # Granular pipeline stage for progress UI (e.g. "loading_model", "generating")
    clone_stage = Column(Text, nullable=True)
    # Verbose error for user display — NULL unless status=failed
    error_message = Column(Text, nullable=True)

    # ── Output ──
    # R2 key for the generated cloned audio file
    output_r2_key = Column(Text, nullable=True)
    # Duration of the generated audio in milliseconds
    output_duration_ms = Column(Integer, nullable=True)

    # ── Credits ──
    # WHY separate credit_cost + credits_deducted:
    # credit_cost is the ESTIMATED cost (set at queue time).
    # credits_deducted is a FLAG — on success, credits are deducted and
    # a credit_transaction is created. On failure (our fault), no deduction.
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
    user = relationship("User", back_populates="clone_jobs")
    voice_asset = relationship("UserAsset", back_populates="clone_jobs")
    # Credit transactions linked to this clone job (SET NULL on delete)
    credit_transactions = relationship("CreditTransaction", back_populates="clone_job")
    history_entries = relationship("History", back_populates="clone_job")

    def __repr__(self):
        return f"<CloneJob {self.id} provider={self.provider} status={self.status}>"
