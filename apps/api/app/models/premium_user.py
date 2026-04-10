from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PremiumUser(Base):
    """
    Premium users table — extends credit info with expenditure tracking.

    NOTE: Schema defined for future use. No routes/services yet.
    """

    __tablename__ = "premium_users"

    clerk_user_id = Column(
        String,
        ForeignKey("users.clerk_user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    credit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("credits.credit_id", ondelete="CASCADE"),
        nullable=False,
    )
    expenditure = Column(Float, default=0.0)

    # ── Relationships ──
    credit = relationship("Credit", back_populates="premium_user")

    def __repr__(self):
        return f"<PremiumUser {self.clerk_user_id} spent={self.expenditure}>"
