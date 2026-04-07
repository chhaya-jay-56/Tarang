"""Async SQLAlchemy setup for Neon PostgreSQL.

Uses asyncpg as the async driver. The DATABASE_URL in .env is
automatically converted — no need to change your .env file.
"""

import ssl as _ssl
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from app.config import settings

# ── Query params that asyncpg doesn't understand (libpq-only) ──
_STRIP_PARAMS = {"channel_binding", "sslmode"}


def _build_async_url(url: str) -> str:
    """Convert a standard postgresql:// URL to postgresql+asyncpg://.

    Also strips libpq-only query params (e.g. channel_binding, sslmode)
    that asyncpg would reject. SSL is handled via connect_args instead.
    """
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    cleaned = {k: v for k, v in params.items() if k not in _STRIP_PARAMS}
    new_query = urlencode(cleaned, doseq=True)

    return urlunparse(parsed._replace(query=new_query))


# Neon requires SSL — asyncpg uses the `ssl` connect_arg instead of `sslmode`
_ssl_ctx = _ssl.create_default_context()

async_engine = create_async_engine(
    _build_async_url(settings.DATABASE_URL),
    echo=False,
    pool_pre_ping=True,
    connect_args={"ssl": _ssl_ctx},
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

# Legacy aliases
engine = async_engine
SessionLocal = AsyncSessionLocal