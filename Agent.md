# Tarang — Agent Context Map

> **Purpose**: This file is the single source of truth for AI agents working on Tarang.
> Read this FIRST before touching any code. Update this file after EVERY change.
>
> **Last Updated**: 2026-04-18

---

## 1. What is Tarang?

AI-powered **voice cloning & dubbing** platform that preserves real emotion.
Users upload a voice sample → the system clones the voice with target text → produces cloned speech output.

**Voice Cloning Engine**: [Replicate IndexTTS-2](https://replicate.com/lucataco/indextts-2) (via HTTP API).  
**Current Focus**: Voice cloning feature is **FULLY IMPLEMENTED** end-to-end. Other features (TTS, projects, credits, premium) are schema-defined but NOT implemented yet.

---

## 2. Monorepo Overview

```
Tarang/
├── apps/
│   ├── home/          → Landing page (public-facing)
│   ├── app/           → Main product app (authenticated dashboard)
│   └── api/           → Backend API (voice cloning logic)
├── Plans/             → Architecture docs (data_flow_explained.md, implementation_plan.md)
├── input_wav/         → Test audio files for CLI testing
├── Agent.md           → THIS FILE — agent context map
├── README.md          → Human-facing project docs
├── .env               → Root env vars (shared secrets)
└── .gitignore
```

| Service | Stack | Port | Deploys To | Status |
|---------|-------|------|------------|--------|
| **home** | Next.js 15, React 19, Tailwind v4, GSAP, Framer Motion | `3000` | Vercel (`tarang-home`) | ✅ Live |
| **app** | Next.js 16, React 19, Clerk Auth, Tailwind v4, WaveSurfer.js | `3001` | Vercel (`tarang-app`) | ✅ Live |
| **api** | FastAPI, async SQLAlchemy, asyncpg, Uvicorn, Python 3.12+ | `8000` | Railway (`tarang-backend`) | ✅ Working |

---

## 3. Backend — `apps/api/` (MAIN CODEBASE)

### 3.1 Directory Structure

```
apps/api/
├── app/
│   ├── __init__.py
│   ├── main.py              # App factory — wires routers, middleware, lifespan ONLY
│   ├── config.py             # Centralized Settings class (loads from .env)
│   ├── database.py           # Async SQLAlchemy engine + AsyncSessionLocal + Base
│   ├── dependencies.py       # Shared FastAPI deps (get_db, get_current_user)
│   ├── middleware.py          # CORS setup (localhost:3000/3001 + ngrok)
│   │
│   ├── models/               # SQLAlchemy ORM — 1 file per table
│   │   ├── __init__.py       # Re-exports: Base, User, Voice, Project, Credit, PremiumUser, History
│   │   ├── user.py           # ✅ DONE — Users table (synced from Clerk webhooks)
│   │   ├── voice.py          # ✅ DONE — Voices table (uploads + clone status + R2 keys)
│   │   ├── history.py        # ✅ DONE — Audit log for history tab
│   │   ├── project.py        # ⏳ SCHEMA ONLY — no routes yet
│   │   ├── credit.py         # ⏳ SCHEMA ONLY — no routes yet
│   │   └── premium_user.py   # ⏳ SCHEMA ONLY — no routes yet
│   │
│   ├── schemas/              # Pydantic request/response validation
│   │   ├── __init__.py
│   │   ├── user.py           # ✅ UserResponse
│   │   ├── voice.py          # ✅ VoiceResponse, PresignedUrlRequest, ConfirmUploadRequest, CloneRequest, etc.
│   │   └── history.py        # ✅ HistoryItemResponse, HistoryListResponse
│   │
│   ├── routers/              # API route handlers
│   │   ├── __init__.py
│   │   ├── health.py         # ✅ GET /health
│   │   ├── webhooks.py       # ✅ POST /api/webhooks/clerk (user.created/updated/deleted)
│   │   ├── voices.py         # ✅ FULLY IMPLEMENTED — 9 endpoints (upload, clone, list, get, status, download, delete)
│   │   └── history.py        # ✅ GET /api/history — returns history entries with download URLs
│   │
│   ├── services/             # Business logic layer
│   │   ├── __init__.py
│   │   └── storage.py        # ✅ R2 storage: upload, download, presigned URLs, delete, metadata
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

### 3.2 Database Schema (Neon PostgreSQL)

**Auth**: Clerk handles auth. Users sync to DB via webhooks. `clerk_user_id` is the FK key across all tables.

```
┌─────────────────┐
│     USERS       │ ← Synced from Clerk webhooks
├─────────────────┤
│ id (UUID, PK)   │
│ clerk_user_id   │ ← UNIQUE, indexed — all FKs point here
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
│ cloned_file_url │ ← filled after   └─────────────────┘
│ original_filename│   clone
│ status          │ ← uploaded|processing|succeeded|failed
│ duration_seconds│
│ file_size_bytes │
│ created_at      │
│ updated_at      │
└──────┬──────────┘
       │ 1:N
┌──────▼──────────┐
│    HISTORY      │ ← Audit log for history tab
├─────────────────┤
│ id (UUID, PK)   │
│ clerk_user_id FK│
│ voice_id FK     │ ← SET NULL on voice delete
│ action          │ ← uploaded|clone_started|clone_completed|clone_failed
│ metadata (JSON) │ ← flexible: filename, duration, error, engine, etc.
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

### 3.3 API Endpoints

| Status | Method | Endpoint | Description | Auth |
|--------|--------|----------|-------------|------|
| ✅ | `GET` | `/health` | Health check | None |
| ✅ | `POST` | `/api/webhooks/clerk` | Clerk user sync (user.created/updated/deleted) | Svix signature |
| ✅ | `POST` | `/api/voices/get-upload-url` | Generate presigned R2 upload URL | Clerk JWT |
| ✅ | `POST` | `/api/voices/confirm-upload` | Confirm browser-to-R2 upload | Clerk JWT |
| ✅ | `POST` | `/api/voices/upload` | Direct server-to-server upload (main upload path) | Clerk JWT |
| ✅ | `POST` | `/api/voices/{voice_id}/clone` | Full cloning pipeline via Replicate | Clerk JWT |
| ✅ | `GET` | `/api/voices` | List user's voices | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}` | Get single voice details | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}/status` | Poll clone status + presigned URL | Clerk JWT |
| ✅ | `GET` | `/api/voices/{voice_id}/download` | Presigned R2 download URL | Clerk JWT |
| ✅ | `DELETE` | `/api/voices/{voice_id}` | Delete voice + R2 files | Clerk JWT |
| ✅ | `GET` | `/api/history` | List user history entries (newest first) | Clerk JWT |

**Status Key**: ✅ = Fully Working | ⏳ = Not started

### 3.4 Key Files Explained

| File | Purpose | Notes |
|------|---------|-------|
| `main.py` | App factory | Wires routers (health, history, webhooks, voices) + middleware + lifespan. Creates tables on startup. |
| `config.py` | Settings | Loads DATABASE_URL, CLERK_*, R2_*, REPLICATE_API_TOKEN from .env |
| `database.py` | DB setup | Async engine with asyncpg driver. Strips libpq-only params. SSL required for Neon. |
| `dependencies.py` | FastAPI deps | `get_db()` yields async session. `get_current_user()` verifies Clerk JWT → returns clerk_user_id. |
| `middleware.py` | CORS | Allows localhost:3000/3001 + ngrok regex pattern. |
| `routers/webhooks.py` | Clerk sync | Svix signature verification. Handles user.created/updated/deleted. |
| `routers/voices.py` | Voice API | Full CRUD + clone pipeline. 9 endpoints. Uses Replicate HTTP API + R2 storage. |
| `routers/history.py` | History API | Returns history with presigned download URLs for completed clones. |
| `services/storage.py` | R2 storage | boto3 client (S3v4 sig). upload/download/delete/presigned URLs/metadata. |
| `utils/auth.py` | JWT verify | PyJWKClient fetches Clerk JWKS. Validates RS256. Returns decoded payload. |

### 3.5 Voice Cloning Pipeline

The `POST /api/voices/{voice_id}/clone` handler runs a **synchronous 7-step pipeline**:

```
1. Validate voice record → mark as "processing"
2. Download raw WAV from R2 (_download_from_r2)
3. Upload WAV to Replicate file storage (POST /v1/files)
4. Create prediction on lucataco/indextts-2 (POST /v1/predictions)
5. Poll prediction status every 3s (GET /v1/predictions/{id})
6. Download cloned audio from Replicate output URL
7. Upload cloned audio to R2 + update DB status → return presigned URL
```

**Model**: `lucataco/indextts-2` version `b219b0f2...`
**Timeout**: 300s (httpx client timeout)
**History logging**: At `clone_started`, `clone_completed`, and `clone_failed` stages.

### 3.6 Dependencies (`pyproject.toml`)

```
fastapi[standard], uvicorn[standard], sqlalchemy[asyncio], asyncpg,
boto3, httpx, pyjwt[crypto], svix, python-dotenv, replicate,
psycopg2-binary, aiosqlite, imagekitio, modal, fastapi-users[sqlalchemy]
```

### 3.7 Environment Variables

```env
DATABASE_URL=             # Neon PostgreSQL connection string
CLERK_WEBHOOK_SECRET=     # From Clerk dashboard → Webhooks
CLERK_JWKS_URL=           # Clerk JWKS endpoint (for JWT verification)
REPLICATE_API_TOKEN=      # Replicate API key (IndexTTS-2 model)
R2_ACCOUNT_ID=            # Cloudflare R2 account ID
R2_BUCKET_NAME=           # R2 bucket name
R2_ACCESS_KEY_ID=         # R2 access key
R2_SECRET_ACCESS_KEY=     # R2 secret key
MAX_UPLOAD_SIZE_MB=50     # Voice file upload limit
REDIS_URL=                # Future: job queue
RUNPOD_API_KEY=           # Future: GPU workers (using Replicate instead)
```

---

## 4. Frontend — `apps/home/` (Landing Page)

```
apps/home/src/
├── app/
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── assets/                   # Static assets
├── components/
│   ├── Background/           # Animated background
│   ├── DecryptedText/        # Text animation effect
│   ├── Header/               # Top header with CTA → Clerk sign-up
│   ├── Hero/                 # Hero section
│   ├── Navbar/               # Navigation bar
│   ├── ReactBits/            # Reusable UI bits
│   └── ShinyText/            # Shiny text effect
├── lib/                      # Utilities
└── index.css                 # Global styles (Tailwind v4)
```Yeah—this is where things get confusing, and you’re not wrong to be stuck.

👉 The reason you don’t see “Secure Device” is usually because of one of these:



Phone is offline

Device not properly linked to Google account

Or Google has changed the UI / removed that option for your device

Some newer Android/MIUI versions don’t allow replacing an existing lock anymore

📱 What you SHOULD see in Google Find My Device

When you open it, normally you get:



🔊 Play Sound

🔒 Secure Device (Lock)

❌ Erase Device

👉 But in many newer phones (especially Xiaomi / Redmi),

“Secure Device” either disappears OR doesn’t override pattern lock anymore

🧠 Important truth (this is the key)

Even if “Secure Device” appears:



It does NOT reliably replace an existing pattern lock anymore

Google tightened security.

🚫 So can you set a new lock from there?

👉 In your case: No — if the option isn’t visible, you can’t force it

There is:



No hidden page

No trick URL

No bypass

🔐 What about Xiaomi side?

Try this as your last non-destructive option:

👉 Mi Find Device

Steps:



Go to i.mi.com

Login with Mi account

Check if device appears

Look for unlock / reset lock

👉 This sometimes works better on Redmi than Google

⚠️ Final reality check

If BOTH fail:

👉 There is NO official or safe way to remove pattern lock without data loss

Because:



Android uses encryption tied to your lock

Breaking lock = breaking encryption

💬 Straight answer (no fluff)

You can’t see “Secure Device” →

👉 That method is not available for your friend’s phone

👍 Your next move

Tell me:



Redmi model (like Note 10, Note 12, etc.)

Is internet ON on that phone?

I’ll give you a clear yes/no chance before you waste time trying random stuff., is it thereis way to 

**Stack**: Next.js 15, React 19, Tailwind v4, GSAP, Framer Motion
**Status**: ✅ Complete — "Get Started Now" button triggers Clerk auth flow

---

## 5. Frontend — `apps/app/` (Main Product Dashboard)

```
apps/app/src/
├── app/
│   ├── layout.tsx              # Root layout with ClerkProvider
│   ├── globals.css             # Custom design tokens + Tailwind v4
│   ├── (auth)/                 # Auth route group (no sidebar)
│   │   ├── layout.tsx          # Minimal auth layout
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   └── (dashboard)/            # Dashboard route group (with sidebar)
│       ├── layout.tsx          # Sidebar + header (UserButton) + main content
│       ├── page.tsx            # / — Welcome page with product cards
│       ├── instant-voice-clone/
│       │   └── page.tsx        # ✅ FULLY WIRED — upload → preview → clone → download
│       ├── history/
│       │   └── page.tsx        # ✅ FULLY WIRED — fetches from /api/history
│       └── text-to-speech/
│           └── page.tsx        # ⏳ Coming Soon placeholder
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx         # Sidebar nav (Home, Voice Cloning, TTS, History)
│   └── ui/
│       ├── button.tsx          # Reusable Button (variants: default, outline, secondary, ghost)
│       └── card.tsx            # Reusable Card component
├── lib/
│   ├── api.ts                  # useApiClient() hook — wraps fetch() with Clerk JWT
│   └── utils.ts                # cn() class merge utility
└── proxy.ts                    # Clerk middleware — protects all routes except sign-in/sign-up
```

**Stack**: Next.js 16, React 19, Clerk Auth, Tailwind v4, WaveSurfer.js, react-icons

### Pages Status

| Route | Page | Status | Live Features |
|-------|------|--------|---------------|
| `/` | Dashboard | ✅ Done | Welcome message, IVC card (linked), TTS card (coming soon) |
| `/instant-voice-clone` | Voice Cloning | ✅ **Fully working** | Drag-drop WAV upload, WaveSurfer preview, text input, clone trigger, cloned audio playback + waveform, download |
| `/history` | History | ✅ **Fully working** | Fetches from /api/history, timeline view, metadata display, download for completed clones |
| `/text-to-speech` | TTS | ⏳ Placeholder | "Coming Soon" |
| `/sign-in`, `/sign-up` | Auth | ✅ Done | Clerk hosted components |

---

## 6. Pending Work (Priority Order)

### Phase 5 — Production Hardening
- [ ] Add Alembic for database migrations (currently using `create_all` on startup)
- [ ] Move cloning to background job (Redis/BullMQ) instead of synchronous
- [ ] Add file validation (size, format, duration limits)
- [ ] Rate limiting on clone endpoint
- [ ] Error monitoring (Sentry/Logfire)

### Phase 6 — Text-to-Speech Feature
- [ ] Implement TTS page UI
- [ ] Integrate TTS model (Replicate or custom)
- [ ] Wire frontend to TTS API

### Phase 7 — Credits & Premium
- [ ] Implement credit deduction on clone
- [ ] Build premium user upgrade flow
- [ ] Add project grouping

---

## 7. Changelog

| Date | What Changed | Files Affected |
|------|-------------|----------------|
| 2026-04-04 | Initial backend setup — User model + Clerk webhooks | `app/models.py`, `app/main.py`, `app/database.py` |
| 2026-04-05 | Clerk auth integrated into Header CTA | `apps/home/src/components/Header/` |
| 2026-04-06 | **Backend restructure** — split monolith into layered arch | All `apps/api/app/` files |
| 2026-04-06 | Created 6 models: User, Voice, Project, Credit, PremiumUser, History | `app/models/` |
| 2026-04-06 | Created Pydantic schemas for Voice, History, User | `app/schemas/` |
| 2026-04-06 | Extracted webhook handler into `routers/webhooks.py` | `app/routers/webhooks.py` |
| 2026-04-06 | Created voice router with 6 stub endpoints | `app/routers/voices.py` |
| 2026-04-06 | Added `config.py`, `dependencies.py` | `app/config.py`, `app/dependencies.py` |
| 2026-04-06 | Cleaned `main.py` — now only app factory (~40 lines) | `app/main.py` |
| 2026-04-09 | Created Agent.md for cross-session context | `Agent.md` |
| 2026-04-13 | Replicate IndexTTS-2 integration — test_replicate.py CLI script | `test_replicate.py` |
| 2026-04-14 | Implemented `utils/auth.py` — Clerk JWT verification (PyJWT + JWKS) | `app/utils/auth.py` |
| 2026-04-14 | Implemented `get_current_user()` dep — extracts clerk_user_id from JWT | `app/dependencies.py` |
| 2026-04-14 | Async database migration — switched to asyncpg + AsyncSession | `app/database.py` |
| 2026-04-14 | Clerk middleware (proxy.ts) — route protection for dashboard | `proxy.ts` |
| 2026-04-14 | `useApiClient()` hook — wraps fetch with Clerk Bearer token | `lib/api.ts` |
| 2026-04-14 | Clerk webhook handler — Svix verification, user CRUD | `routers/webhooks.py` |
| 2026-04-15 | Implemented `services/storage.py` — R2 upload/download/presigned/delete | `app/services/storage.py` |
| 2026-04-15 | Voice upload endpoints — presigned URL + confirm + direct upload | `app/routers/voices.py` |
| 2026-04-16 | Built Instant Voice Clone page UI with WaveSurfer.js audio preview | `instant-voice-clone/page.tsx` |
| 2026-04-17 | Fixed CORS — refactored to server-to-server upload (bypasses browser CORS) | `routers/voices.py`, `page.tsx` |
| 2026-04-17 | **Full cloning pipeline** — upload to Replicate, poll, download, store in R2 | `routers/voices.py` |
| 2026-04-17 | History logging — audit trail at upload/clone_started/completed/failed | `routers/voices.py`, `routers/history.py` |
| 2026-04-17 | Download endpoint — presigned R2 URL for cloned audio | `routers/voices.py` |
| 2026-04-17 | History page — fetches from API, shows timeline with downloads | `(dashboard)/history/page.tsx` |
| 2026-04-18 | Agent.md updated to reflect full implementation status | `Agent.md` |

---

> **AGENT RULE**: After ANY code change, update this file. Add to the Changelog, update file statuses, and modify the directory tree if files were added/removed/moved.
