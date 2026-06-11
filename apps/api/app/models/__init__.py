# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# This __init__.py re-exports ALL ORM models from one place so other modules
# can do: `from app.models import User, CloneJob` etc.
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
# TABLES (7 active, dubbing tables moved to Desktop/Dubbing):
#   users, user_assets, clone_jobs, credit_transactions, history,
#   preset_voices, custom_voices
# ─────────────────────────────────────────────────────────────────────────────

from app.database import Base

from app.models.user import User
from app.models.user_asset import UserAsset, AssetType
from app.models.clone_job import CloneJob, CloneJobStatus
from app.models.credit_transaction import CreditTransaction, TxnType
from app.models.history import History
from app.models.preset_voice import PresetVoice
from app.models.custom_voice import CustomVoice

__all__ = [
    "Base",
    # ── Core ──
    "User",
    # ── Asset library ──
    "UserAsset", "AssetType",
    # ── Voice cloning ──
    "CloneJob", "CloneJobStatus",
    # ── Voice library (split tables) ──
    "PresetVoice",
    "CustomVoice",
    # ── Credits ──
    "CreditTransaction", "TxnType",
    # ── History ──
    "History",
]

