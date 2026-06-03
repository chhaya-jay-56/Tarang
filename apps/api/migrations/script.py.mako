# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# This is a Mako template (.mako) that Alembic uses to GENERATE new migration
# files when you run `alembic revision` or `alembic revision --autogenerate`.
#
# CONCEPT: Mako is a Python template engine (like Jinja2 but simpler).
# Alembic chose Mako because it was already a SQLAlchemy ecosystem dependency.
# The ${"${"}variables} below get replaced with actual values when generating a
# new migration file.
#
# WHY we customize this template:
#   - We add docstrings explaining the migration
#   - We ensure consistent imports across all generated files
#   - The default template is bare-bones; ours matches our annotation style
# ─────────────────────────────────────────────────────────────────────────────

"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# ── Alembic revision identifiers (used by the migration tracker) ──
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Apply this migration — move the DB schema FORWARD."""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Revert this migration — move the DB schema BACKWARD."""
    ${downgrades if downgrades else "pass"}
