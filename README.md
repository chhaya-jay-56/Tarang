# Tarang Monorepo

A monorepo containing three services that power the **Tarang** platform — AI-powered voice dubbing that preserves real emotion.

## Architecture

```
Tarang/
├── apps/
│   ├── home/          → Landing page (Next.js + TypeScript)
│   ├── app/           → Main product app (Next.js + TypeScript)
│   └── api/           → Backend API (FastAPI + Python)
│       └── app/
│           ├── main.py         → App factory
│           ├── config.py       → Centralized settings
│           ├── database.py     → SQLAlchemy engine
│           ├── dependencies.py → Shared FastAPI deps
│           ├── middleware.py   → CORS
│           ├── models/         → 6 ORM models
│           ├── schemas/        → Pydantic validation
│           ├── routers/        → API route handlers
│           ├── services/       → Business logic (WIP)
│           └── utils/          → Helpers (WIP)
├── Agent.md           → AI agent context map (read this first)
├── README.md          → This file
├── .env.example
└── .gitignore
```

## Services

| Service | Stack | Port | Deploys To |
|---------|-------|------|------------|
| **home** | Next.js 15, React 19, Tailwind v4, GSAP, Framer Motion | `3000` | Vercel (Project: `tarang-home`) |
| **app** | Next.js 16, React 19, Clerk Auth, Tailwind v4 | `3001` | Vercel (Project: `tarang-app`) |
| **api** | FastAPI, SQLAlchemy, Uvicorn, Python 3.12+ | `8000` | Railway (Project: `tarang-backend`) |

> **GPU Workers** inside `apps/api` deploy separately to **RunPod**.

---

## API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/health` | Health check | ✅ |
| `POST` | `/api/webhooks/clerk` | Clerk user sync | ✅ |
| `POST` | `/api/voices/upload` | Upload voice sample | 🔧 Stub |
| `POST` | `/api/voices/{id}/clone` | Trigger clone | 🔧 Stub |
| `GET` | `/api/voices` | List voices | 🔧 Stub |
| `GET` | `/api/voices/{id}` | Voice details | 🔧 Stub |
| `GET` | `/api/voices/{id}/status` | Clone status | 🔧 Stub |
| `DELETE` | `/api/voices/{id}` | Delete voice | 🔧 Stub |

---

## Database (Neon PostgreSQL)

6 tables — `users`, `voices`, `history`, `projects`, `credits`, `premium_users`.
Auth via **Clerk** — users synced through webhooks. `clerk_user_id` is the FK across all tables.

---

## Local Development

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.12
- **uv** (Python package manager) — [install guide](https://docs.astral.sh/uv/)

### 1. TarangHome (Landing Page)

```bash
cd apps/home
npm install
npm run dev
# → http://localhost:3000
```

### 2. TarangApp (Main Product)

```bash
cd apps/app
npm install
npm run dev
# → http://localhost:3001
```

### 3. TarangBackend (API)

```bash
cd apps/api
uv venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
uv pip install -r pyproject.toml
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

> See [`apps/api/README.md`](apps/api/README.md) for detailed backend setup.

---

## Environment Variables

Copy the root template and fill in your values:

```bash
cp .env.example .env
```

Each app also has its own `.env.local.example` (or `.env.example` for the API) with only the vars relevant to that service.

---

## Deployment

| Service | Provider | Project Name |
|---------|----------|-------------|
| `apps/home` | Vercel | `tarang-home` |
| `apps/app` | Vercel | `tarang-app` |
| `apps/api` | Railway | `tarang-backend` |
| GPU workers | RunPod | (separate, stays as-is) |
