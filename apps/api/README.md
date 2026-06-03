# TarangBackend — FastAPI API

The backend API for the Tarang platform. Built with FastAPI, SQLAlchemy, and Python 3.12+.

**Deploys to:** Railway (Project: `tarang-backend`)  
**GPU Workers:** RunPod (separate deployment, stays as-is)

---

## Prerequisites

- **Python** ≥ 3.12
- **uv** — [install guide](https://docs.astral.sh/uv/)

---

## Setup

```bash
# 1. Create virtual environment
uv venv

# 2. Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 3. Install dependencies
uv pip install -r pyproject.toml

# 4. Copy env vars
cp .env.example .env
# Fill in DATABASE_URL, CLERK_WEBHOOK_SECRET or CLERK_WEBHOOK_SIGNING_SECRET, etc.
```

---

## Running Locally

### API Server (Uvicorn)

```bash
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

Or using uv directly:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

### Clerk Webhooks with ngrok

This webhook lives in the FastAPI app, so tunnel the API server, not the Next.js app:

```bash
ngrok http --url=<your-ngrok-domain> 8000
```

In Clerk, set the endpoint URL to:

```text
https://<your-ngrok-domain>/api/webhooks
```

The legacy URL `https://<your-ngrok-domain>/api/webhooks/clerk` is also accepted.
Use the endpoint Signing Secret as either `CLERK_WEBHOOK_SECRET` or
`CLERK_WEBHOOK_SIGNING_SECRET` in the root `.env` or `apps/api/.env`.

### Celery Worker (when configured)

> **Note:** Celery/Redis dependencies are not yet in `pyproject.toml`.
> Once added, run the worker with:

```bash
celery -A app.worker worker --loglevel=info
```

Make sure Redis is running and `REDIS_URL` is set in your `.env`.

---

## API Docs

Once the server is running, visit:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
