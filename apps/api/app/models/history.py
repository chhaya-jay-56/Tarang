import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class History(Base):
    """
    History table — audit log of voice actions for the history tab.

    Each entry records what happened (action) with flexible metadata.
    Examples:
        action="uploaded",       metadata={"filename": "sample.wav", "size_bytes": 12345}
        action="clone_started",  metadata={"engine": "xtts"}
        action="clone_completed", metadata={"duration_seconds": 4.2}
        action="clone_failed",   metadata={"error": "GPU timeout"}
    """

    __tablename__ = "history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(
        String,
        ForeignKey("users.clerk_user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    voice_id = Column(
        String,
        ForeignKey("voices.voice_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    action = Column(String, nullable=False)  # uploaded | clone_started | clone_completed | clone_failed
    metadata_ = Column("metadata", JSON, nullable=True)  # flexible payload

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ──
    user = relationship("User", back_populates="history")
    voice = relationship("Voice", back_populates="history_entries")

    def __repr__(self):
        return f"<History {self.action} voice={self.voice_id}>"
