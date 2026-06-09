# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores saved voices in the user's voice library. A voice is a named,
# reusable reference audio stored on R2. Two types:
#   - custom: user uploaded their own reference audio
#   - preset: platform-provided pre-built voices (Sarthak, Fireship etc.)
#
# CONCEPT: Voice Library (like ElevenLabs Voice Lab)
#   Users create voices by uploading reference audio, then reuse them
#   across clone jobs and TTS generation without re-uploading.
#
# WHY separate from user_assets:
#   user_assets tracks raw file uploads (any file). saved_voices adds
#   a name, description, language, and voice_type layer on top — it's
#   the user-facing "My Voices" library, not a generic file store.
#
# WHY is_preset + nullable user_id:
#   Preset voices belong to the platform, not a user. user_id is NULL
#   for presets and NOT NULL for custom voices. is_preset flag makes
#   queries simple: WHERE is_preset = true for platform library.
#
# FLOW:
#   Voice Library page → user uploads audio → creates SavedVoice →
#   Clone page → user picks voice → R2 key used as reference audio
# ─────────────────────────────────────────────────────────────────────────────

import uuid
import enum

from sqlalchemy import (
    Column, Text, Integer, Boolean, DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class VoiceType(enum.Enum):
    """Types of saved voices.

    custom → user created by uploading reference audio
    preset → platform pre-built voice (non-deletable by users)
    """
    custom = "custom"
    preset = "preset"


class SavedVoice(Base):
    """
    User's voice library — named, reusable reference voices.

    Custom voices: user uploads reference audio → stored on R2 → reused.
    Preset voices: platform-provided voices, visible to all users.
    """

    __tablename__ = "saved_voices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── FK to users.id — NULL for preset voices (platform-owned)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,  # NULL = preset voice
        index=True,
    )

    # ── Voice metadata
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    voice_type = Column(
        Enum(VoiceType, name="voice_type", create_type=False),
        nullable=False,
        server_default="custom",
    )

    # ── R2 key for the reference audio file
    r2_key = Column(Text, nullable=False)

    # ── Language of the voice (ISO 639-1 code)
    language = Column(Text, nullable=False, server_default="en")

    # ── Audio duration in milliseconds
    duration_ms = Column(Integer, nullable=True)

    # ── Preset flag for easy querying
    is_preset = Column(Boolean, nullable=False, server_default="false")

    # ── Flexible metadata (model used, source info, etc.)
    metadata_ = Column("metadata", JSONB, nullable=True)

    # ── Timestamps
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships
    user = relationship("User", back_populates="saved_voices")

    def __repr__(self):
        return f"<SavedVoice {self.name} type={self.voice_type.value}>"
