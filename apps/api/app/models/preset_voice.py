# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Stores platform-owned preset voices — pre-built voices visible to ALL users.
# Unlike custom voices (user-created), preset voices have NO user_id.
#
# SPLIT FROM: saved_voices (which mixed presets + custom in one table)
# WHY SPLIT:
#   The old saved_voices table used is_preset + nullable user_id to distinguish
#   preset vs custom voices. This caused r2_key collisions when users created
#   proxy UserAssets for preset voices (UNIQUE constraint on user_assets.r2_key
#   is global, not per-user). Separate tables eliminate the collision.
#
# CONCEPT: Platform Voice Library
#   Admin-seeded voices like "Sarthak", "Fireship" that appear in every
#   user's voice picker under the "Pre-built" section.
# ─────────────────────────────────────────────────────────────────────────────

import uuid

from sqlalchemy import Column, Text, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class PresetVoice(Base):
    """Platform-owned preset voice — visible to all users, admin-managed.

    No user_id — these belong to the platform, not individual users.
    r2_key is globally unique since only admins create these.
    """

    __tablename__ = "preset_voices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Voice metadata
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    # ── R2 key for the reference audio file (globally unique for presets)
    r2_key = Column(Text, nullable=False, unique=True)

    # ── Language of the voice (ISO 639-1 code)
    language = Column(Text, nullable=False, server_default="en")

    # ── Audio duration in milliseconds
    duration_ms = Column(Integer, nullable=True)

    # ── Flexible metadata (model used, source info, etc.)
    metadata_ = Column("metadata", JSONB, nullable=True)

    # ── Timestamps
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self):
        return f"<PresetVoice {self.name}>"
