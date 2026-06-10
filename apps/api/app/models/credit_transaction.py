# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Full audit trail for every credit movement. Replaces the old `credits`
# table. Balance lives on `users.credit_balance`; this table is the LEDGER.
#
# CONCEPT: Immutable Ledger (from final_schema_review.md §9)
#   INSERT-only. Each row has `balance_after` snapshot for point-in-time
#   reconstruction. Never update or delete rows.
#
# WHY txn_type not type: `type` is a PG reserved keyword — causes ORM issues.
# WHY CHECK(amount > 0): $0 transactions are meaningless.
# WHY chk_one_job_ref: links to at most ONE job type (clone OR dub, not both).
# WHY RESTRICT on user_id: can't delete user with financial history.
# WHY SET NULL on job FKs: job deletion preserves financial records.
#
# FLOW: top_up/deduction/refund → INSERT row → balance_after snapshot
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Integer, DateTime, ForeignKey, Enum, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class TxnType(enum.Enum):
    """top_up = purchased credits, deduction = job consumed, refund = failure refund."""
    top_up = "top_up"
    deduction = "deduction"
    refund = "refund"


class CreditTransaction(Base):
    """Credit audit trail — immutable ledger. INSERT-only, never update/delete."""

    __tablename__ = "credit_transactions"

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_transaction_amount_positive"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    clone_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clone_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    txn_type = Column(
        Enum(TxnType, name="txn_type", create_type=False), nullable=False,
    )
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ──
    user = relationship("User", back_populates="credit_transactions")
    clone_job = relationship("CloneJob", back_populates="credit_transactions")

    def __repr__(self):
        return f"<CreditTransaction {self.txn_type.value} amount={self.amount}>"
