"""add_missing_dub_job_status_enum_values

Alembic autogenerate does NOT handle enum value additions.
This manual migration adds: uploading, extracting_audio, separating.

Revision ID: a1b2c3d4e5f6
Revises: 58c91234eaf7
Create Date: 2026-06-11 08:05:00.000000+00:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '58c91234eaf7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new enum values to dub_job_status.

    PostgreSQL requires ALTER TYPE ... ADD VALUE for each new enum entry.
    These must run outside a transaction block.
    """
    op.execute("ALTER TYPE dub_job_status ADD VALUE IF NOT EXISTS 'uploading' BEFORE 'transcribing'")
    op.execute("ALTER TYPE dub_job_status ADD VALUE IF NOT EXISTS 'extracting_audio' BEFORE 'transcribing'")
    op.execute("ALTER TYPE dub_job_status ADD VALUE IF NOT EXISTS 'separating' BEFORE 'transcribing'")


def downgrade() -> None:
    """Cannot remove enum values in PostgreSQL — no-op."""
    pass
