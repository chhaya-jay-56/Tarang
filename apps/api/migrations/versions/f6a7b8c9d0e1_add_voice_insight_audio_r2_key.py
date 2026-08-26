"""Store a permanent R2 key for VoiceInsight audio playback.

Revision ID: f6a7b8c9d0e1
Revises: a82a1b555976
Create Date: 2026-08-26 17:10:00.000000+05:30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "a82a1b555976"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("call_analysis", sa.Column("audio_r2_key", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("call_analysis", "audio_r2_key")
