# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# This __init__.py re-exports ALL ORM models from one place so other modules
# can do: `from app.models import User, CloneJob, DubJob` etc.
#
# CONCEPT: Barrel Export / Package Re-export
#   Without this, every module would need to know the exact file path of
#   each model. This centralizes imports and — critically — ensures ALL
#   models are registered on Base.metadata before Alembic's autogenerate
#   runs. If a model isn't imported here, Alembic won't see its table.
#
# WHY we also export Base:
#   Alembic's env.py does `from app.models import Base` to get the metadata.
#   Exporting it here keeps the import chain clean.
#
# TABLES (10 total, matching final_schema_review.md):
#   users, uploaded_videos, user_assets, clone_jobs, dub_jobs,
#   transcription_segments, dub_segments, final_dubs,
#   credit_transactions, history
# ─────────────────────────────────────────────────────────────────────────────

from app.database import Base

from app.models.user import User
from app.models.uploaded_video import UploadedVideo, UploadedVideoStatus
from app.models.user_asset import UserAsset, AssetType
from app.models.clone_job import CloneJob, CloneJobStatus
from app.models.dub_job import DubJob, DubJobStatus
from app.models.transcription_segment import TranscriptionSegment
from app.models.dub_segment import DubSegment, DubSegmentStatus
from app.models.final_dub import FinalDub
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.history import History

__all__ = [
    "Base",
    # ── Core ──
    "User",
    # ── Video uploads ──
    "UploadedVideo", "UploadedVideoStatus",
    # ── Asset library ──
    "UserAsset", "AssetType",
    # ── Voice cloning ──
    "CloneJob", "CloneJobStatus",
    # ── Video dubbing pipeline ──
    "DubJob", "DubJobStatus",
    "TranscriptionSegment",
    "DubSegment", "DubSegmentStatus",
    "FinalDub",
    # ── Credits ──
    "CreditTransaction", "TxnType",
    # ── History ──
    "History",
]
