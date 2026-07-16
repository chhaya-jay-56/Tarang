# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Global app configuration stored in the DB instead of hardcoded constants.
# Allows admin to change free-tier caps, credit amounts, etc. at runtime
# without redeploying. Currently used by webhooks.py (user signup) and
# the early-adopter status endpoint.
#
# DESIGN:
#   Simple key→value store. Values are stored as TEXT (JSON-encoded) to
#   support integers, strings, and objects with one column type.
#   JSONB was considered but TEXT is simpler for our current needs (all
#   values are single integers).
#
# SEED DATA (created by migration):
#   'free_tier_cap'     → '200'   (max early-adopter users)
#   'free_tier_credits'  → '1500'  (credits granted on signup)
# ─────────────────────────────────────────────────────────────────────────────

from sqlalchemy import Column, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class AppConfig(Base):
    """Global configuration key-value store.

    Admin-editable via /api/admin/config endpoints.
    Values are stored as TEXT — callers parse to int/JSON as needed.
    """

    __tablename__ = "app_config"

    key = Column(Text, primary_key=True)
    value = Column(Text, nullable=False)
    updated_by = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<AppConfig {self.key}={self.value}>"
