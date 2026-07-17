"""add deleted_users table and update credit_transactions FK

Revision ID: c7d8e9f0a1b2
Revises: b3c4d5e6f7a8
Create Date: 2026-07-17 18:00:00.000000

Changes:
  1. Create `deleted_users` table for archiving deleted user accounts
  2. Alter `credit_transactions.user_id` FK: RESTRICT → SET NULL, make nullable
  3. Add `deleted_user_email` column to `credit_transactions` for traceability
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c7d8e9f0a1b2"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create deleted_users archive table ──
    op.create_table(
        "deleted_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("original_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("plan_type", sa.Text(), nullable=False, server_default="free"),
        sa.Column("credit_balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credit_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "original_created_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    # Index on email for fast lookups on re-signup
    op.create_index("ix_deleted_users_email", "deleted_users", ["email"])

    # ── 2. Add deleted_user_email column to credit_transactions ──
    op.add_column(
        "credit_transactions",
        sa.Column("deleted_user_email", sa.Text(), nullable=True),
    )

    # ── 3. Alter credit_transactions.user_id FK: RESTRICT → SET NULL ──
    # Drop the old RESTRICT FK constraint
    op.drop_constraint(
        "credit_transactions_user_id_fkey",
        "credit_transactions",
        type_="foreignkey",
    )
    # Make user_id nullable
    op.alter_column(
        "credit_transactions",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    # Re-create FK with SET NULL
    op.create_foreign_key(
        "credit_transactions_user_id_fkey",
        "credit_transactions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # ── Reverse FK change ──
    op.drop_constraint(
        "credit_transactions_user_id_fkey",
        "credit_transactions",
        type_="foreignkey",
    )
    op.alter_column(
        "credit_transactions",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_foreign_key(
        "credit_transactions_user_id_fkey",
        "credit_transactions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # ── Remove deleted_user_email column ──
    op.drop_column("credit_transactions", "deleted_user_email")

    # ── Drop deleted_users table ──
    op.drop_index("ix_deleted_users_email", "deleted_users")
    op.drop_table("deleted_users")
