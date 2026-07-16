"""add admin dashboard schema

Adds credit_limit, is_admin to users table.
Adds service_type to credit_transactions table.
Creates app_config table with seed data.
Backfills credit_limit for existing early-adopter users.

Revision ID: b3c4d5e6f7a8
Revises: f5a8b2c3d4e5
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'b3c4d5e6f7a8'
down_revision = '6852d130554b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add columns to users ──
    op.add_column('users', sa.Column('credit_limit', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))

    # ── 2. Add service_type to credit_transactions ──
    op.add_column('credit_transactions', sa.Column('service_type', sa.Text(), nullable=True))

    # ── 3. Create app_config table ──
    op.create_table(
        'app_config',
        sa.Column('key', sa.Text(), primary_key=True),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_by', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── 4. Seed app_config with default values ──
    op.execute("INSERT INTO app_config (key, value) VALUES ('free_tier_cap', '200')")
    op.execute("INSERT INTO app_config (key, value) VALUES ('free_tier_credits', '1500')")

    # ── 5. Backfill credit_limit for existing users who received early-adopter bonus ──
    # Users who have a top_up transaction got 1500 credits on signup.
    # Set their credit_limit to 1500 so the UI shows correct X/Y.
    op.execute("""
        UPDATE users SET credit_limit = 1500
        WHERE id IN (
            SELECT DISTINCT user_id FROM credit_transactions
            WHERE txn_type = 'top_up'
        )
    """)


def downgrade() -> None:
    op.drop_table('app_config')
    op.drop_column('credit_transactions', 'service_type')
    op.drop_column('users', 'is_admin')
    op.drop_column('users', 'credit_limit')
