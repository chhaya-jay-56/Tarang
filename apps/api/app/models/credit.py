import uuid
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Credit(Base):
    """
    Credits table — tracks each user's credit balance and type.

    NOTE: Schema defined for future use. No routes/services yet.
    """

    __tablename__ = "credits"

    credit_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(
        String,
        ForeignKey("users.clerk_user_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    credits_count = Column(Integer, default=0)
    user_type = Column(String, default="free")  # free | premium

    # ── Relationships ──
    user = relationship("User", back_populates="credit")
    premium_user = relationship("PremiumUser", back_populates="credit", uselist=False)

    def __repr__(self):
        return f"<Credit {self.clerk_user_id} credits={self.credits_count}>"
