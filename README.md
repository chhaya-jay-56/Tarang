# Tarang — AI Voice Cloning SaaS

**Tarang** is a scalable AI-powered Software-as-a-Service (SaaS) platform designed for hyper-realistic voice cloning and dubbing. By leveraging state-of-the-art TTS models, it allows users to generate high-fidelity voice clones that preserve genuine human emotion and nuance.

---

## 🏗 Architecture & Stack

Tarang is engineered as a modern, decoupled monorepo containing three core micro-applications, optimized for high performance and secure cloud deployment.

| Service | Tech Stack | Role in Platform |
|---------|------------|-------------|
| **Home** | Next.js 15, Tailwind v4, Framer Motion | Public-facing marketing site. Optimized for SEO and conversion with dynamic, GSAP-powered animations. |
| **App** | Next.js 16, Clerk Auth, Zustand, WaveSurfer.js | The authenticated SaaS dashboard. Provides a seamless interface for users to manage audio assets, preview generated speech, and track usage history. |
| **API** | FastAPI, Python 3.12, async SQLAlchemy | The backend engine. Handles complex synchronous orchestration of AI generation, direct R2 storage uploads, and database telemetry. |

---

## ✨ SaaS Features & Capabilities

The core infrastructure and end-to-end generation pipelines are fully functional and secure:

- **Secure Authentication Pipeline:** Enterprise-grade authentication powered by Clerk, with real-time webhook synchronization (Svix-verified) to the internal backend.
- **Serverless Object Storage:** Utilizes Cloudflare R2 for zero-egress, high-speed audio asset storage. Direct server-side proxy uploads are implemented to completely bypass browser CORS limitations securely.
- **AI Audio Orchestration:** Synchronous, resilient integration with the `lucataco/indextts-2` model via Replicate's HTTP API, wrapped in a robust polling mechanism.
- **Interactive Audio Workspace:** Rich frontend experience featuring WaveSurfer.js for precise waveform visualization and playback of both reference and cloned audio.
- **Immutable Audit Logging:** Every interaction across the generation pipeline (upload, processing, success, failure) is logged persistently for user history and future billing integration.
- **Secure Asset Delivery:** Finished assets are delivered to the frontend strictly via time-limited, presigned URLs.

---

## 💾 Data Modeling & Infrastructure

The platform's state is managed via **Neon Serverless PostgreSQL** utilizing an asynchronous SQLAlchemy ORM layer. 

The schema is heavily normalized around the central `clerk_user_id`:
- `users`: Synchronized identities and tier tracking.
- `voices`: Central registry linking user assets to Cloudflare R2 bucket keys and cloning statuses.
- `history`: Telemetry and logging for generation events.
- *(Future schema expansions already prepared for premium subscriptions, credit-based billing, and project-based grouping).*

---

## 🌍 Target Deployment Architecture (In Progress)

The platform architecture is optimized for deployment across modern serverless and edge providers:
- **Frontend Infrastructure**: Designed for edge delivery via **Vercel** (`home` and `app` services).
- **Backend Infrastructure**: Containerized backend ready for scalable deployment via **Railway** (`api` service).
- **Asset Storage**: Deeply integrated with **Cloudflare R2** for fast, zero-egress object storage.
- **Database**: Configured for Serverless PostgreSQL via **Neon**.
