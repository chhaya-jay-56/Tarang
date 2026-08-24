# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Adds 'TRANSCRIPT_READY' to the analysisstatus PostgreSQL enum.
# This new status indicates that Gladia transcription is done and the
# transcript is saved, but Sarvam intelligence extraction hasn't been
# triggered yet. Previously the pipeline auto-transitioned to EXTRACTING
# via background tasks that died in serverless (Vercel/Cloud Run).
# Now the user manually triggers extraction via a button.
#
# Also migrates any existing EXTRACTING rows without intelligence
# to TRANSCRIPT_READY so the user can re-trigger extraction.
# ─────────────────────────────────────────────────────────────────────────────

"""Add transcript_ready status to analysisstatus enum

Revision ID: e2f3a4b5c6d7
Revises: 1e1de1742a14
Create Date: 2026-08-24 14:25:00.000000+05:30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# ── Alembic revision identifiers ──
revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = '1e1de1742a14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add TRANSCRIPT_READY to the analysisstatus enum."""
    # PostgreSQL enums need ALTER TYPE to add new values
    op.execute("ALTER TYPE analysisstatus ADD VALUE IF NOT EXISTS 'TRANSCRIPT_READY' AFTER 'TRANSCRIBING'")

    # NOTE: Cannot UPDATE rows to use the new enum value in the same transaction
    # (PostgreSQL restriction). Stale EXTRACTING rows are migrated to
    # TRANSCRIPT_READY at runtime by the self-healing GET /calls/{id} endpoint.


def downgrade() -> None:
    """Revert: migrate TRANSCRIPT_READY rows back to EXTRACTING.

    NOTE: PostgreSQL does not support DROP VALUE from enums without
    recreating the type. We only migrate the data back.
    """
    op.execute("""
        UPDATE call_analysis
        SET status = 'EXTRACTING'
        WHERE status = 'TRANSCRIPT_READY'
    """)
