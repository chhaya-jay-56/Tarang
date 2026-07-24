# ── Stage 1: Builder ──
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv for fast dependency resolution (pinned version for reproducibility)
COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /usr/local/bin/uv

# Copy dependency files first (cache layer)
COPY pyproject.toml ./

# Install dependencies into a virtual env
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python -r pyproject.toml

# ── Stage 2: Runtime ──
FROM python:3.12-slim

# Install ffmpeg (required for audio format conversion in clone_service)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual env from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Set PATH to use venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

# Run migrations then start server
# Using shell form so $PORT is expanded
CMD alembic upgrade head && \
    uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
