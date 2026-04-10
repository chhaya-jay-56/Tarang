import uuid
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Voice(Base):
    """
    Voices table — one row per uploaded voice sample.

    Tracks the original upload and its cloned output.
    Files are stored in S3/Supabase; only URLs are kept here.
    """

    __tablename__ = "voices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voice_id = Column(String, unique=True, nullable=False, index=True)
    clerk_user_id = Column(
        String,
        ForeignKey("users.clerk_user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── File storage ──
    original_file_url = Column(String, nullable=True)   # S3/Supabase path for uploaded voice
    cloned_file_url = Column(String, nullable=True)      # filled after cloning completes
    original_filename = Column(String, nullable=True)     # user-facing filename

    # ── Status tracking ──
    status = Column(String, default="uploaded")  # uploaded | processing | succeeded | failed
    clone_stage = Column(String, nullable=True)     # granular pipeline stage for progress UI
    error_message = Column(String, nullable=True)   # verbose error for user display

    # ── Metadata ──
    duration_seconds = Column(Float, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    # ── Timestamps ──
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ──
    user = relationship("User", back_populates="voices")
    history_entries = relationship("History", back_populates="voice", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Voice {self.voice_id} status={self.status}>"
