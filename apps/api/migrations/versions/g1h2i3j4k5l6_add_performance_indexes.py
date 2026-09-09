"""add_performance_indexes

Revision ID: g1h2i3j4k5l6
Revises: f6a7b8c9d0e1
Create Date: 2026-08-31 20:00:00.000000+00:00

WHY: Neon compute audit revealed sequential scans on high-frequency
query paths: history listing, credit transaction aggregation, call
analysis listing, and JSONB metadata lookups. These indexes target
the exact WHERE + ORDER BY patterns used by the API routers.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# ── Alembic revision identifiers ──
revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes for high-frequency query paths."""

    # ── History: WHERE user_id=? ORDER BY created_at DESC ──
    # Used by: GET /api/history (every user session)
    op.create_index(
        'ix_history_user_created',
        'history',
        ['user_id', sa.text('created_at DESC')],
    )

    # ── Credit Transactions: admin service_usage GROUP BY ──
    # Used by: GET /api/admin/insights/service-usage
    op.create_index(
        'ix_credit_txn_type',
        'credit_transactions',
        ['txn_type'],
    )
    op.create_index(
        'ix_credit_txn_created',
        'credit_transactions',
        ['created_at'],
    )

    # ── Call Analysis: WHERE user_id=? ORDER BY created_at DESC ──
    # Used by: GET /api/v1/voice-insight/calls (list + paginate)
    op.create_index(
        'ix_call_analysis_user_created',
        'call_analysis',
        ['user_id', sa.text('created_at DESC')],
    )
    # ── Call Analysis: WHERE user_id=? AND status=? ──
    # Used by: GET /api/v1/voice-insight/analytics
    op.create_index(
        'ix_call_analysis_user_status',
        'call_analysis',
        ['user_id', 'status'],
    )

    # ── Users: ORDER BY created_at (admin user listing) ──
    op.create_index(
        'ix_users_created_at',
        'users',
        ['created_at'],
    )

    # ── History: GIN index on JSONB metadata ──
    # Used by: GET /api/v1/separation/{job_id}/download/{stem}
    # The JSONB query metadata->>'job_id' = ? was doing a full table scan
    op.execute(
        "CREATE INDEX ix_history_metadata_gin ON history "
        "USING gin(metadata jsonb_path_ops)"
    )


def downgrade() -> None:
    """Remove performance indexes."""
    op.execute("DROP INDEX IF EXISTS ix_history_metadata_gin")
    op.drop_index('ix_users_created_at', table_name='users')
    op.drop_index('ix_call_analysis_user_status', table_name='call_analysis')
    op.drop_index('ix_call_analysis_user_created', table_name='call_analysis')
    op.drop_index('ix_credit_txn_created', table_name='credit_transactions')
    op.drop_index('ix_credit_txn_type', table_name='credit_transactions')
    op.drop_index('ix_history_user_created', table_name='history')
