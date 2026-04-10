import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    """
    Users table — synced from Clerk via webhooks.

    clerk_user_id is the business key from Clerk.
    All other tables FK to this via clerk_user_id.
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    plan_type = Column(String, default="free")
    credit_balance = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ──
    voices = relationship("Voice", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    credit = relationship("Credit", back_populates="user", uselist=False, cascade="all, delete-orphan")
    history = relationship("History", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.clerk_user_id} ({self.email})>"
