import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base

class Feedback(Base):
    """
    Feedback table — Stores user feedback from landing page and studio app.
    """
    __tablename__ = "feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    source = Column(String, nullable=False, server_default="unknown")
    
    # Optional foreign key to users table for authenticated users
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("User", backref="feedbacks")

    def __repr__(self):
        return f"<Feedback {self.id} from {self.name}>"
