# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# The `users` table is the ANCHOR of the entire Tarang schema. Every other
# table FKs back to `users.id` (UUID surrogate key). User records are synced
# from Clerk via webhooks — Clerk is the source of truth for authentication,
# and this table is our source of truth for application-level user data.
#
# CONCEPT: Clerk Webhook Sync (from final_schema_review.md §1)
#   Clerk manages auth (sign-up, login, OAuth). On user events (created,
#   updated, deleted), Clerk fires a webhook to our API. The webhook handler
#   upserts this table using `clerk_user_id` as the business key.
#
# WHY UUID primary key instead of clerk_user_id:
#   Business keys can change (Clerk could update their ID format). UUID
#   surrogate keys are immutable, so all FK references remain stable.
#   clerk_user_id is kept as a UNIQUE indexed column for webhook lookups.
#
# WHY credit_balance lives here (not in a separate credits table):
#   The old schema had a `credits` table + `premium_users` table. That was
#   over-normalized — credit balance is a core user attribute read on every
#   request. A separate `credit_transactions` table provides the audit trail.
#   This follows the ElevenLabs model: balance on user, ledger in transactions.
#
# WHY CHECK constraints:
#   - chk_credit_balance_non_negative: Prevents negative balance at DB level
#     (defense in depth — app layer also validates, but DB is the last guard)
#   - chk_plan_type: Restricts to known values without needing a PG ENUM
#     (TEXT + CHECK is more flexible than ENUM for values that might expand)
#
# FLOW CONNECTION:
#   webhooks.py → upserts User → all other tables FK to User.id
#   Every authenticated request → looks up User by clerk_user_id
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import (
    Column, String, Integer, DateTime, Text, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    """
    Users table — Clerk-anchored user record with credit balance.

    clerk_user_id is the business key from Clerk webhooks.
    All other tables FK to this via `id` (UUID surrogate key).
    """

    __tablename__ = "users"

    # ── Why we use table_args for CHECK constraints:
    # SQLAlchemy's `CheckConstraint` in __table_args__ creates DB-level
    # constraints that persist even if someone modifies data via raw SQL.
    __table_args__ = (
        CheckConstraint("credit_balance >= 0", name="chk_credit_balance_non_negative"),
        CheckConstraint("plan_type IN ('free', 'premium')", name="chk_plan_type"),
    )

    # ── Primary key — UUID generated in Python (not DB-side gen_random_uuid)
    # WHY Python-side: Allows us to know the ID before INSERT (useful for
    # creating related objects in the same transaction without a flush)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Business key from Clerk — used for webhook lookups
    clerk_user_id = Column(Text, unique=True, nullable=False, index=True)

    email = Column(Text, nullable=False)

    # ── Name from Clerk (first_name + last_name) — nullable because
    # Clerk doesn't require names on all OAuth providers
    name = Column(Text, nullable=True)

    # ── Plan gating — TEXT with CHECK instead of ENUM for flexibility
    # WHY TEXT over ENUM: Adding a new plan type (e.g. 'enterprise') only
    # needs a CHECK constraint update, not an ALTER TYPE which locks the table
    plan_type = Column(Text, nullable=False, server_default="free")

    # ── Credit balance — whole integer credits (like ElevenLabs)
    # No platform charges fractional credits, so INTEGER is sufficient
    credit_balance = Column(Integer, nullable=False, server_default="0")

    # ── Timestamps ──
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # WHY server_default + onupdate: server_default sets the initial value
    # via DB-side NOW(). onupdate fires on SQLAlchemy UPDATE (Python-side).
    # We ALSO have a DB-level trigger (set_updated_at) for raw SQL updates.
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ──
    # WHY cascade="all, delete-orphan" on some, not others:
    #   CASCADE: When user is deleted, delete their uploads/assets/clones/history
    #   RESTRICT (no cascade): credit_transactions + dub_jobs prevent user deletion
    #     if they have active jobs — this is intentional for audit safety
    uploaded_videos = relationship(
        "UploadedVideo", back_populates="user", cascade="all, delete-orphan"
    )
    user_assets = relationship(
        "UserAsset", back_populates="user", cascade="all, delete-orphan"
    )
    clone_jobs = relationship(
        "CloneJob", back_populates="user", cascade="all, delete-orphan"
    )
    # WHY no cascade on dub_jobs: ON DELETE RESTRICT — can't delete user with
    # active dubbing jobs (they might have credits deducted)
    dub_jobs = relationship("DubJob", back_populates="user")
    # WHY no cascade on credit_transactions: ON DELETE RESTRICT — audit trail
    # must never be accidentally deleted
    credit_transactions = relationship("CreditTransaction", back_populates="user")
    history = relationship(
        "History", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.clerk_user_id} ({self.email})>"
