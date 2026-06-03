# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# env.py is the RUNTIME BRAIN of Alembic. When you run any `alembic` command,
# Alembic reads alembic.ini, then executes THIS file to set up the database
# connection and run migrations.
#
# CONCEPT: Alembic env.py — Runtime Migration Environment
#   - Connects to the database using our app's existing config (app.config)
#   - Provides `target_metadata` so Alembic's autogenerate can diff ORM models
#     against the live DB schema and auto-write migration scripts
#   - Uses ASYNC engine because our DB layer (app.database) is async (asyncpg)
#
# WHY async env instead of sync:
#   Our app uses asyncpg (async PostgreSQL driver). Alembic's default env.py
#   is sync, which would need a SEPARATE sync connection string + psycopg2.
#   By using `run_async_migrations()`, we reuse the SAME async engine config,
#   keeping one source of truth for DB connection settings.
#
# WHY we import from app.models (not app.database):
#   `app.models.__init__` imports ALL model files, which registers them on
#   Base.metadata. If we only imported Base from database.py, the metadata
#   would be EMPTY and autogenerate would see zero tables.
#
# FLOW:
#   1. alembic.ini → points to this env.py
#   2. env.py → imports settings.DATABASE_URL + Base.metadata
#   3. env.py → creates async engine, runs migrations inside a transaction
#   4. Migration files in versions/ → called by Alembic's migration runner
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

# ── WHY this sys.path insert:
# Alembic loads env.py from the migrations/ directory. Python can't find the
# `app` package unless we add the api root (apps/api/) to sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── Import our app's config and models ──
# IMPORTANT: We must import from app.models (not app.database) so that all
# model classes are registered on Base.metadata before autogenerate runs.
# The __init__.py in models/ does `from app.models.user import User` etc.,
# which triggers SQLAlchemy to register each table on Base.metadata.
from app.config import settings
from app.models import Base
from app.database import _build_async_url


# ── Alembic Config object — provides access to alembic.ini values ──
config = context.config

# ── Override the sqlalchemy.url from alembic.ini with our app's DATABASE_URL ──
# WHY: alembic.ini has a placeholder URL. We override it here so credentials
# live in .env (via app.config.Settings), not in alembic.ini checked into git.
config.set_main_option("sqlalchemy.url", _build_async_url(settings.DATABASE_URL))

# ── Setup Python logging from alembic.ini's [loggers] section ──
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── target_metadata tells Alembic what the ORM "wants" the DB to look like ──
# Autogenerate compares this metadata against the live DB to produce diffs.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting.

    WHY this exists: Useful for generating SQL scripts to review or hand off
    to a DBA before running. Not commonly used in dev, but required by Alembic.

    In offline mode, Alembic writes SQL statements to stdout instead of
    executing them against the database.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Shared migration runner — used by both online sync and async paths.

    WHY a separate function: The async path needs to pass a connection into
    `context.configure()` inside `run_sync()`. Extracting this avoids
    duplicating the configuration logic.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # compare_type=True catches column type changes (e.g. VARCHAR → TEXT)
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations using an ASYNC engine — the main execution path.

    WHY async: Our app uses asyncpg. Using async here means we reuse the
    exact same connection config (SSL context, URL format, etc.) instead
    of maintaining a separate sync psycopg2 connection.

    FLOW:
      1. Create a throwaway async engine from alembic.ini config
      2. Open a connection
      3. Use `run_sync()` to bridge into Alembic's sync migration runner
      4. Dispose the engine (close all connections)
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        # Neon PostgreSQL requires SSL — pass the same ssl context our app uses
        connect_args={"ssl": __import__("ssl").create_default_context()},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the DB and executes.

    WHY asyncio.run: Alembic's entry point is synchronous, but our engine
    is async. asyncio.run() bridges the gap by running our async migration
    function in a new event loop.
    """
    asyncio.run(run_async_migrations())


# ── Entry point — Alembic calls this when running any migration command ──
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
