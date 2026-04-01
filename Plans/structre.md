# Tarang — Full Project Walkthrough

> **Last Updated**: 2026-04-18  
> This document provides a complete, up-to-date explanation of the **Tarang** project — its architecture, every service, how they communicate, and the current implementation status.

---

## 1. What is Tarang?

**Tarang** is an AI-powered **voic when i make plan or summary in antigravity the file itself is formatted in human readable way all diagram looking structruzed as soon i close ide again open the same file it scattered things ? why i need same as i gete cloning & dubbing** platform that preserves real emotion.

**Core workflow**:
1. User uploads a WAV voice sample → stored in **Cloudflare R2**
2. Backend sends the sample to **Replicate** (IndexTTS-2 model) with target text
3. Replicate generates cloned speech → backend stores the output in R2
4. User plays/downloads the cloned audio from the dashboard

**Current scope**: Only the **Instant Voice Clone** feature is fully implemented end-to-end. Other features (TTS, projects, credits, premium tiers) have database schemas defined but no routes or UI yet.

--- when i make plan or summary in antigravity the file itself is formatted in human readable way all diagram looking structruzed as soon i close ide again open the same file it scattered things ? why i need same as i get

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Tarang Monorepo                             │
├────────────────┬───────────────────┬────────────────────────────────┤
│   apps/home    │    apps/app       │         apps/api               │
│  (Landing)     │   (Dashboard)     │       (Backend)                │
│                │                   │                                │
│  Next.js 15    │  Next.js 16       │  FastAPI + SQLAlchemy          │
│  React 19      │  React 19         │  Python 3.12+                  │
│  Tailwind v4   │  Tailwind v4      │  Async (asyncpg)               │
│  GSAP + FM     │  Clerk Auth       │  Uvicorn                       │
│                │  WaveSurfer.js    │                                │
│  Port: 3000    │  Port: 3001       │  Port: 8000                    │
│  → Vercel      │  → Vercel         │  → Railway                     │
└────────────────┴───────────────────┴────────────────────────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
              ┌──────▼──────┐   ┌────────▼────────┐   ┌──────▼──────┐
              │  Neon DB    │   │ Cloudflare R2   │   │  Replicate  │
              │ PostgreSQL  │   │ Object Storage  │   │ IndexTTS-2  │
              └─────────────┘   └─────────────────┘   └─────────────┘
```

---

## 3. Services at a Glance

| Service | Stack | Port | Deploys To | Status |
|---------|-------|------|------------|--------|
| **home** | Next.js 15, React 19, Tailwind v4, GSAP, Framer Motion | `3000` | Vercel (`tarang-home`) | ✅ Live |
| **app** | Next.js 16, React 19, Clerk Auth, Tailwind v4, WaveSurfer.js | `3001` | Vercel (`tarang-app`) | ✅ Live |
| **api** | FastAPI, async SQLAlchemy, asyncpg, Uvicorn, Python 3.12+ | `8000` | Railway (`tarang-backend`) | ✅ Working |

---

## 4. External Services & Integrations

| Service | Purpose | How Integrated |
|---------|---------|----------------|
| **Clerk** | Auth (user sign-up/sign-in) | Frontend SDK + backend JWT verification + webhook sync |
| **Neon PostgreSQL** | Primary database | async SQLAlchemy + asyncpg driver, SSL required |
| **Cloudflare R2** | Object storage for audio files | boto3 S3-compatible client in `services/storage.py` |
| **Replicate** | AI model hosting (IndexTTS-2 voice cloning) | HTTP API calls in `routers/voices.py` |

---

## 5. Authentication Flow

```
Browser → Clerk SDK → JWT Token
                         │
                         ▼
        FastAPI ← Authorization: Bearer <JWT>
                         │
                         ▼
        dependencies.py: get_current_user()
                         │
                         ▼
        utils/auth.py: verify_clerk_token()
          - Fetches Clerk JWKS (cached)
          - Validates RS256 signature
          - Returns clerk_user_id (sub claim)
```

Users are synced to the database via **Clerk webhooks** (`user.created`, `user.updated`, `user.deleted`) → handled by `routers/webhooks.py` with Svix signature verification.

---

## 6. Backend — `apps/api/`

### 6.1 Directory Structure

```
apps/api/
├── app/
│   ├── __init__.py
│   ├── main.py              # App factory — wires routers, middleware, lifespan
│   ├── config.py             # Settings class (loads all env vars from .env)
│   ├── database.py           # Async SQLAlchemy engine + session factory + Base
│   ├── dependencies.py       # get_db(), get_current_user() (Clerk JWT)
│   ├── middleware.py          # CORS setup
│   │
│   ├── models/               # SQLAlchemy ORM — 1 file per table
│   │   ├── __init__.py       # Re-exports: Base, User, Voice, Project, Credit, PremiumUser, History
│   │   ├── user.py           # ✅ Users (synced from Clerk webhooks)
│   │   ├── voice.py          # ✅ Voices (uploads + cloning status + R2 keys)
│   │   ├── history.py        # ✅ Audit log (tracks every upload/clone action)
│   │   ├── project.py        # ⏳ Schema only — no routes
│   │   ├── credit.py         # ⏳ Schema only — no routes
│   │   └── premium_user.py   # ⏳ Schema only — no routes
│   │
│   ├── schemas/              # Pydantic request/response validation
│   │   ├── __init__.py
│   │   ├── user.py           # UserResponse
│   │   ├── voice.py          # VoiceResponse, PresignedUrlRequest, ConfirmUploadRequest, CloneRequest, etc.
│   │   └── history.py        # HistoryItemResponse, HistoryListResponse
│   │
│   ├── routers/              # API route handlers
│   │   ├── __init__.py
│   │   ├── health.py         # ✅ GET /health
│   │   ├── webhooks.py       # ✅ POST /api/webhooks/clerk
│   │   ├── voices.py         # ✅ Full voice CRUD + cloning pipeline
│   │   └── history.py        # ✅ GET /api/history
│   │
│   ├── services/             # Business logic layer
│   │   ├── __init__.py
│   │   └── storage.py        # ✅ R2 operations: upload, download, presigned URLs, delete
│   │
│   └── utils/                # Shared helpers
│       ├── __init__.py
│       └── auth.py           # ✅ Clerk JWT verification (PyJWT + JWKS)
│
├── test_replicate.py         # CLI test script for Replicate IndexTTS-2
├── set_r2_cors.py            # Utility to set CORS on R2 bucket
├── pyproject.toml            # Dependencies managed by uv
└── uv.lock
```

### 6.2 Database Schema (Neon PostgreSQL)

```
┌─────────────────┐
│     USERS       │ ← Synced from Clerk webhooks
├─────────────────┤
│ id (UUID, PK)   │
│ clerk_user_id   │ ← UNIQUE, indexed — FK key across all tables
│ email           │
│ name            │
│ plan_type       │ (default: "free")
│ credit_balance  │ (default: 0)
│ created_at      │
└──────┬──────────┘
       │ 1:N
       ├──────────────────────────────────────┐
       │                                      │
┌──────▼──────────┐                   ┌───────▼─────────┐
│    VOICES       │                   │    PROJECTS     │ ⏳ Future
├─────────────────┤                   ├─────────────────┤
│ id (UUID, PK)   │                   │ id (UUID, PK)   │
│ voice_id (UK)   │ ← human-readable │ clerk_user_id FK│
│ clerk_user_id FK│                   │ project_name    │
│ original_file_url│ ← R2 key        │ created_at      │
│ cloned_file_url │ ← filled post-   └─────────────────┘
│ original_filename│   clone
│ status          │ ← uploaded|processing|succeeded|failed
│ duration_seconds│
│ file_size_bytes │
│ created_at      │
│ updated_at      │
└──────┬──────────┘
       │ 1:N
┌──────▼──────────┐
│    HISTORY      │ ← Audit log
├─────────────────┤
│ id (UUID, PK)   │
│ clerk_user_id FK│
│ voice_id FK     │ ← SET NULL on voice delete
│ action          │ ← uploaded|clone_started|clone_completed|clone_failed
│ metadata (JSON) │ ← flexible: filename, duration, error_msg, engine, etc.
│ created_at      │
└─────────────────┘

┌─────────────────┐        ┌─────────────────┐
│    CREDITS      │ ⏳     │ PREMIUM_USERS   │ ⏳
├─────────────────┤        ├─────────────────┤
│ credit_id (PK)  │◄───────│ clerk_user_id FK│
│ clerk_user_id FK│        │ credit_id FK    │
│ credits_count   │        │ expenditure     │
│ user_type       │        └─────────────────┘
└─────────────────┘
```

### 6.3 API Endpoints

| Status | Method | Endpoint | Description | Auth |
|--------|--------|----------|-------------|------|
| ✅ | `GET` | `/health` | Health check | None |
| ✅ | `POST` | `/api/webhooks/clerk` | Clerk user sync (user.created/updated/deleted) | Svix signature |
| ✅ | `POST` | `/api/voices/get-upload-url` | Generate presigned R2 upload URL | Clerk JWT |
| ✅ | `POST` | `/api/voices/confirm-upload` | Confirm browser-to-R2 upload + save to DB | Clerk JWT |
| ✅ | `POST` | `/api/voices/upload` | Direct server-to-server upload (bypasses CORS) | Clerk JWT |
| ✅ | `POST` | `/api/voices/{voice_id}/clone` | Full cloning pipeline via Replicate IndexTTS-2 | Clerk JWT |
| ✅ | `GET` | `/api/voices` | List user's voices | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}` | Get single voice details | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}/status` | Poll clone status + presigned download URL | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}/download` | Presigned R2 download URL for cloned audio | Clerk JWT |
| ✅ | `DELETE` | `/api/voices/{voice_id}` | Delete voice + R2 files | Clerk JWT |
| ✅ | `GET` | `/api/history` | List user's cloning history (newest first) | Clerk JWT |

### 6.4 Voice Cloning Pipeline (Detail)

The `POST /api/voices/{voice_id}/clone` endpoint executes a 7-step synchronous pipeline:

1. **Validate** — Ensure voice exists, belongs to user, and isn't already processing
2. **Download from R2** — Fetch raw WAV bytes from Cloudflare R2 via boto3
3. **Upload to Replicate** — POST the WAV to Replicate's file storage endpoint
4. **Create prediction** — POST to `/v1/predictions` with model version + input (text + speaker_audio URL)
5. **Poll** — GET `/v1/predictions/{id}` every 3 seconds until `succeeded`, `failed`, or `canceled`
6. **Download output** — Fetch the cloned audio from Replicate's output URL
7. **Store in R2** — Upload cloned audio to `voices/cloned/{user_id}/{voice_id}.wav` and update DB status

History entries are logged at each stage (`clone_started`, `clone_completed`, `clone_failed`).

### 6.5 Storage Layer (`services/storage.py`)

Uses **boto3** with S3v4 signatures against **Cloudflare R2**:

| Function | Purpose |
|----------|---------|
| `get_r2_client()` | Creates boto3 S3 client configured for R2 |
| `upload_file(bytes, key)` | PUT object to R2 |
| `get_upload_presigned_url(key)` | Presigned PUT URL (1hr expiry) |
| `get_download_presigned_url(key)` | Presigned GET URL (1hr expiry) |
| `get_object_metadata(key)` | HEAD object (returns None if missing) |
| `delete_file(key)` | DELETE object from R2 |

**R2 key structure**:
- Raw uploads: `voices/raw/{clerk_user_id}/{voice_id}.wav`
- Cloned outputs: `voices/cloned/{clerk_user_id}/{voice_id}.wav`

### 6.6 Dependencies (`pyproject.toml`)

```
fastapi[standard], uvicorn[standard], sqlalchemy[asyncio], asyncpg,
boto3, httpx, pyjwt[crypto], svix, python-dotenv, replicate,
psycopg2-binary, aiosqlite, imagekitio, modal, fastapi-users[sqlalchemy]
```

### 6.7 Environment Variables

```env
DATABASE_URL=             # Neon PostgreSQL connection string
CLERK_WEBHOOK_SECRET=     # From Clerk → Webhooks dashboard
CLERK_JWKS_URL=           # Clerk JWKS endpoint for JWT verification
REPLICATE_API_TOKEN=      # Replicate API key for IndexTTS-2
R2_ACCOUNT_ID=            # Cloudflare R2 account
R2_BUCKET_NAME=           # R2 bucket name
R2_ACCESS_KEY_ID=         # R2 access key
R2_SECRET_ACCESS_KEY=     # R2 secret key
MAX_UPLOAD_SIZE_MB=50     # Voice file upload limit
REDIS_URL=                # Future: job queue
RUNPOD_API_KEY=           # Future: GPU workers
```

---

## 7. Frontend — `apps/home/` (Landing Page)

### 7.1 Purpose
Public-facing marketing/landing page. Contains hero section, animated background, and a "Get Started Now" CTA that triggers Clerk auth flow redirecting to `apps/app`.

### 7.2 Directory Structure

```
apps/home/src/
├── app/
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── assets/                  # Static assets
├── components/
│   ├── Background/          # Animated particle/gradient background
│   ├── DecryptedText/       # Text reveal animation effect
│   ├── Header/              # Top header with CTA → Clerk sign-up
│   ├── Hero/                # Hero section with headline + subtext
│   ├── Navbar/              # Navigation bar
│   ├── ReactBits/           # Reusable UI utility components
│   └── ShinyText/           # Shimmering text animation effect
├── lib/                     # Utilities
└── index.css                # Global styles (Tailwind v4)
```

### 7.3 Stack & Status
**Stack**: Next.js 15, React 19, Tailwind v4, GSAP, Framer Motion  
**Status**: ✅ Complete & deployed

---

## 8. Frontend — `apps/app/` (Main Product Dashboard)

### 8.1 Purpose
Authenticated dashboard where users upload voice samples, trigger cloning, listen to output, and view history.

### 8.2 Directory Structure

```
apps/app/src/
├── app/
│   ├── layout.tsx              # Root layout with ClerkProvider
│   ├── globals.css             # Global CSS (Tailwind v4 + custom design tokens)
│   ├── (auth)/                 # Auth route group (no sidebar)
│   │   ├── layout.tsx          # Minimal auth layout
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   └── (dashboard)/            # Dashboard route group (with sidebar)
│       ├── layout.tsx          # Dashboard layout: Sidebar + header (UserButton) + main
│       ├── page.tsx            # / — Welcome dashboard with product cards
│       ├── instant-voice-clone/
│       │   └── page.tsx        # ✅ Full voice cloning UI (upload, preview, clone, download)
│       ├── history/
│       │   └── page.tsx        # ✅ History page (fetches from /api/history)
│       └── text-to-speech/
│           └── page.tsx        # ⏳ Coming Soon placeholder
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx         # Sidebar navigation (Home, Voice Cloning, TTS, History)
│   └── ui/
│       ├── button.tsx          # Reusable Button component (multiple variants)
│       └── card.tsx            # Reusable Card component
├── lib/
│   ├── api.ts                  # useApiClient() hook — wraps fetch with Clerk JWT
│   └── utils.ts                # cn() utility (class merging)
└── proxy.ts                    # Clerk middleware — protects all routes except sign-in/sign-up
```

### 8.3 Key Components Explained

#### `lib/api.ts` — `useApiClient()`
The core hook for all API communication. Wraps `fetch()` by:
- Attaching Clerk JWT as `Authorization: Bearer <token>`
- Auto-detecting FormData vs JSON for `Content-Type`
- Adding `ngrok-skip-browser-warning` header for dev tunneling

#### `proxy.ts` — Clerk Middleware
Route protection:
- **Public routes**: `/sign-in(.*)`, `/sign-up(.*)`
- **All other routes**: Protected via `auth.protect()`

#### `Sidebar.tsx`
Navigation to 4 pages: Home, Voice Cloning, Text to Speech, History.

### 8.4 Pages

| Route | Page | Status | Features |
|-------|------|--------|----------|
| `/` | Dashboard | ✅ Complete | Welcome message, product cards (IVC, TTS) |
| `/instant-voice-clone` | Voice Cloning | ✅ **Fully wired** | Drag-drop upload, WaveSurfer audio preview, text input, clone button, cloned audio player with waveform, download |
| `/history` | History | ✅ **Fully wired** | Fetches from API, shows timeline of uploads/clones/failures with metadata, download link for completed clones |
| `/text-to-speech` | TTS | ⏳ Coming Soon | Placeholder page |
| `/sign-in` | Auth | ✅ | Clerk SignIn component |
| `/sign-up` | Auth | ✅ | Clerk SignUp component |

### 8.5 Voice Cloning Page Flow

```
1. User drops/selects a .wav file
     → File preview with WaveSurfer waveform (play/pause/seek)
2. User clicks "Upload Audio"
     → POST /api/voices/upload (FormData) → voice_id returned
3. User types target text + clicks "Clone Voice"
     → POST /api/voices/{voice_id}/clone {text} → waits ~30-90s
4. On success → output_url returned
     → Cloned audio rendered with WaveSurfer (play/pause/seek)
5. User clicks "Download"
     → GET /api/voices/{voice_id}/download → presigned URL → blob download
```

### 8.6 Stack
**Stack**: Next.js 16, React 19, Clerk Auth, Tailwind v4, WaveSurfer.js, react-icons  
**Status**: ✅ Fully functional

---

## 9. Data Flow Diagrams

### 9.1 Voice Upload Flow

```
Browser                      FastAPI                       R2
  │                            │                            │
  │─── POST /api/voices/upload ──▶│                         │
  │    (FormData: .wav file)   │                            │
  │                            │── upload_file(bytes) ─────▶│
  │                            │◀── OK ────────────────────│
  │                            │── INSERT voices table      │
  │                            │── INSERT history (uploaded) │
  │◀── {voice_id, status} ────│                            │
```

### 9.2 Voice Cloning Flow

```
Browser                  FastAPI                Replicate              R2
  │                        │                      │                    │
  │─ POST /{id}/clone ──▶│                      │                    │
  │                        │── download from R2 ──────────────────────▶│
  │                        │◀── raw WAV bytes ───────────────────────│
  │                        │── POST /files ──────▶│                    │
  │                        │◀── file_url ────────│                    │
  │                        │── POST /predictions ▶│                    │
  │                        │◀── prediction_id ───│                    │
  │                        │── GET /predictions ─▶│ (poll every 3s)   │
  │                        │◀── "succeeded" ─────│                    │
  │                        │── GET output_url ───▶│                    │
  │                        │◀── cloned bytes ────│                    │
  │                        │── upload_file() ───────────────────────▶│
  │                        │── UPDATE voices table │                   │
  │                        │── INSERT history       │                   │
  │◀── {status, url} ────│                        │                   │
```

---

## 10. Local Development

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.12
- **uv** (Python package manager)

### Start Landing Page
```bash
cd apps/home
npm install && npm run dev     # → http://localhost:3000
```

### Start Dashboard App
```bash
cd apps/app
npm install && npm run dev     # → http://localhost:3001
```

### Start Backend API
```bash
cd apps/api
uv venv
# Windows: .venv\Scripts\activate
uv pip install -r pyproject.toml
uvicorn app.main:app --reload --port 8000   # → http://localhost:8000
```

---

## 11. Deployment

| Service | Provider | Project Name |
|---------|----------|-------------|
| `apps/home` | Vercel | `tarang-home` |
| `apps/app` | Vercel | `tarang-app` |
| `apps/api` | Railway | `tarang-backend` |

---

## 12. Current Status Summary

### ✅ Completed
- Full voice cloning pipeline (upload → clone → download)
- Clerk auth integration (frontend SDK + backend JWT + webhook sync)
- Cloudflare R2 storage with presigned URLs
- Replicate IndexTTS-2 integration
- History audit log with UI
- WaveSurfer.js audio preview for both reference and cloned audio
- CORS middleware for local dev + ngrok tunneling

### ⏳ Not Yet Implemented
- Text-to-Speech feature
- Credit system (deduction on clone)
- Premium user tiers
- Project grouping
- Alembic database migrations
- Redis job queue (currently cloning is synchronous)
- RunPod GPU workers (using Replicate instead)
