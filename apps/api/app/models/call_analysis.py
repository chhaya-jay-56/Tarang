# ---------------------------------------------------------------------------
# WHY THIS FILE EXISTS:
# SQLAlchemy model for storing VoiceInsight call analysis records.
# This integrates Gladia transcription outputs and Sarvam-30B intelligence.
# ---------------------------------------------------------------------------

import uuid
import enum

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import Index

from app.database import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    TRANSCRIBING = "transcribing"       # Gladia processing
    TRANSCRIPT_READY = "transcript_ready" # Gladia done, awaiting manual Sarvam trigger
    EXTRACTING = "extracting"           # Sarvam-30B Modal processing (sync)
    COMPLETED = "completed"
    FAILED = "failed"


class CallAnalysis(Base):
    """
    Model for storing Call Analysis jobs and their results.
    """

    __tablename__ = "call_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # FK to users.id
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    
    status = Column(Enum(AnalysisStatus), default=AnalysisStatus.PENDING, nullable=False, index=True)
    
    # Metadata about the audio file
    filename = Column(String(255), nullable=True)
    audio_url = Column(String(1024), nullable=True) # S3/ImageKit/Gladia URL
    duration_seconds = Column(Float, nullable=True)
    
    # IDs for external services
    gladia_job_id = Column(String(255), nullable=True, index=True)
    
    # Results
    # transcript will store the raw JSON from Gladia
    transcript = Column(JSONB, nullable=True)
    # intelligence will store the extracted insights from Sarvam-30B
    intelligence = Column(JSONB, nullable=True)
    
    # For full-text search across transcript
    search_vector = Column(TSVECTOR, nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now(), 
        onupdate=func.now()
    )

    # ── Relationships ──
    user = relationship("User")

    # Index for full-text search
    __table_args__ = (
        Index('ix_call_analysis_search_vector', search_vector, postgresql_using='gin'),
    )

    def __repr__(self):
        return f"<CallAnalysis {self.id} status={self.status}>"
