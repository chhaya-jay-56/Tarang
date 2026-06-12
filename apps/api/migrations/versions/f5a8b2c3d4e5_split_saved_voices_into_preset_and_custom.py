# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS MIGRATION EXISTS:
# Splits the saved_voices table into two separate tables:
#   - preset_voices: platform-owned voices (admin-seeded, no user_id)
#   - custom_voices: user-created voices (has user_id, uploaded or from clone)
#
# WHY THE SPLIT:
#   The old saved_voices table mixed preset and custom voices using
#   is_preset + nullable user_id. This caused r2_key collisions when
#   the clone pipeline created proxy UserAsset records — the UNIQUE
#   constraint on user_assets.r2_key is global, causing crashes on
#   2nd TTS generation attempts.
#
# DATA MIGRATION:
#   - 3 preset voices (is_preset=true) → preset_voices
#   - Custom voices (is_preset=false) → custom_voices
# ─────────────────────────────────────────────────────────────────────────────

"""split saved_voices into preset and custom

Revision ID: f5a8b2c3d4e5
Revises: d1ae0fce7831
Create Date: 2026-06-22 03:15:00.000000+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ── Alembic revision identifiers ──
revision: str = 'f5a8b2c3d4e5'
down_revision: Union[str, None] = 'd1ae0fce7831'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply this migration — split saved_voices into preset_voices + custom_voices."""

    # ── 1. Create preset_voices table ──
    op.create_table('preset_voices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('r2_key', sa.Text(), nullable=False),
        sa.Column('language', sa.Text(), server_default='en', nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('r2_key'),
    )

    # ── 2. Create custom_voices table ──
    op.create_table('custom_voices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('r2_key', sa.Text(), nullable=False),
        sa.Column('language', sa.Text(), server_default='en', nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.Text(), server_default='upload', nullable=False),
        sa.Column('source_clone_job_id', sa.UUID(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_clone_job_id'], ['clone_jobs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'r2_key', name='uq_custom_voice_user_r2_key'),
    )
    op.create_index(op.f('ix_custom_voices_user_id'), 'custom_voices', ['user_id'], unique=False)

    # ── 3. Migrate data from saved_voices → new tables ──
    # Preset voices (is_preset = true)
    op.execute("""
        INSERT INTO preset_voices (id, name, description, r2_key, language, duration_ms, metadata, created_at)
        SELECT id, name, description, r2_key, language, duration_ms, metadata, created_at
        FROM saved_voices
        WHERE is_preset = true
    """)

    # Custom voices (is_preset = false)
    op.execute("""
        INSERT INTO custom_voices (id, user_id, name, description, r2_key, language, duration_ms, source_type, metadata, created_at)
        SELECT id, user_id, name, description, r2_key, language, duration_ms, 'upload', metadata, created_at
        FROM saved_voices
        WHERE is_preset = false AND user_id IS NOT NULL
    """)

    # ── 4. Drop old table ──
    op.drop_index(op.f('ix_saved_voices_user_id'), table_name='saved_voices')
    op.drop_table('saved_voices')


def downgrade() -> None:
    """Revert this migration — recreate saved_voices from preset + custom."""

    # ── 1. Recreate saved_voices ──
    op.create_table('saved_voices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('voice_type', sa.Enum('custom', 'preset', name='voice_type'), server_default='custom', nullable=False),
        sa.Column('r2_key', sa.Text(), nullable=False),
        sa.Column('language', sa.Text(), server_default='en', nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('is_preset', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_saved_voices_user_id'), 'saved_voices', ['user_id'], unique=False)

    # ── 2. Migrate data back ──
    op.execute("""
        INSERT INTO saved_voices (id, user_id, name, description, voice_type, r2_key, language, duration_ms, is_preset, metadata, created_at)
        SELECT id, NULL, name, description, 'preset', r2_key, language, duration_ms, true, metadata, created_at
        FROM preset_voices
    """)
    op.execute("""
        INSERT INTO saved_voices (id, user_id, name, description, voice_type, r2_key, language, duration_ms, is_preset, metadata, created_at)
        SELECT id, user_id, name, description, 'custom', r2_key, language, duration_ms, false, metadata, created_at
        FROM custom_voices
    """)

    # ── 3. Drop new tables ──
    op.drop_index(op.f('ix_custom_voices_user_id'), table_name='custom_voices')
    op.drop_table('custom_voices')
    op.drop_table('preset_voices')
