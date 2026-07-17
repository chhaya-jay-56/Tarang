# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Archive table for deleted user accounts. When a user deletes their account,
# their row is copied here BEFORE being removed from the `users` table.
#
# PURPOSE:
#   1. Prevent credit abuse: if a user deletes and re-signs up, we check this
#      table to see how many credits they already consumed and deduct from
#      their new initial grant.
#   2. Audit trail: keeps a record of all deleted accounts for admin review.
#
# KEY DESIGN DECISIONS:
#   - NO foreign keys: this is a flat archive table with no relationships.
#   - `credits_used` is pre-computed at deletion time (credit_limit - credit_balance)
#     for fast lookups on re-signup.
#   - `email` is indexed because re-signup lookups query by email.
#   - `original_user_id` preserves the UUID from the `users` table for traceability.
#
# FLOW:
#   user.deleted webhook → copy user row here → delete from users
#   user.created webhook → check this table by email → adjust initial credits
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import Column, Text, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class DeletedUser(Base):
    """
    Archive of deleted user accounts.

    Stores a snapshot of the user at the time of deletion, including
    how many credits they consumed. Used to prevent credit abuse on re-signup.
    """

    __tablename__ = "deleted_users"

    # ── Primary key — own UUID, NOT the original user's UUID
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── The user's original UUID from the `users` table
    original_user_id = Column(UUID(as_uuid=True), nullable=False)

    # ── Clerk ID at time of deletion
    clerk_user_id = Column(Text, nullable=False)

    # ── Email — INDEXED for re-signup lookups
    email = Column(Text, nullable=False, index=True)

    # ── Name at time of deletion
    name = Column(Text, nullable=True)

    # ── Plan at deletion
    plan_type = Column(Text, nullable=False, server_default="free")

    # ── Credit snapshot at deletion
    credit_balance = Column(Integer, nullable=False, server_default="0")
    credit_limit = Column(Integer, nullable=False, server_default="0")

    # ── Pre-computed: credit_limit - credit_balance
    # WHY pre-computed: avoids math on every re-signup lookup query
    credits_used = Column(Integer, nullable=False, server_default="0")

    # ── Admin flag snapshot
    is_admin = Column(Boolean, nullable=False, server_default="false")

    # ── When the original account was created
    original_created_at = Column(DateTime(timezone=True), nullable=True)

    # ── When the account was deleted (archive timestamp)
    deleted_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self):
        return f"<DeletedUser {self.email} (used={self.credits_used})>"
