# Architecture

This document is the single source of truth for the system architecture of VideoRankingStudio (VRS). It is updated whenever an architectural decision changes.

## 1. Goals & non-goals

### Goals
- Produce vertical short-form video (9:16, 1080×1920) from heterogeneous inputs (long-form video, URL, script, template) with minimal manual editing.
- Provide a multi-tenant SaaS suitable for subscription monetization.
- Be **provider-agnostic** for AI services (TTS, STT, LLM, image gen, video gen) — swap implementations by env var.
- Scale independently per workload: API requests, queue depth, and GPU inference all scale on different axes.
- Be deployable to a single VM (docker-compose) for local/staging, and to AWS via Terraform for production.

### Non-goals (for now)
- Real-time multi-user collaborative editing (Figma-style).
- Native mobile apps (we ship a responsive web app first; mobile becomes possible via the `sdk` package).
- On-device inference.

## 2. Service topology

VRS is a **modular monolith of services**: three first-party applications, backed by managed infrastructure. Each can be deployed independently.

| Service             | Language         | Purpose                                                                              |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `apps/web`          | TypeScript, Next.js 14 | User-facing web app: marketing, auth, editor, dashboard, admin, billing portal |
| `apps/api`          | TypeScript, Fastify    | Backend HTTP + WebSocket API: auth, CRUD, billing, AI-job orchestration         |
| `apps/workers`      | Python 3.11, FastAPI + Celery | Heavy-lifting workers: FFmpeg, Whisper, TTS, image gen, exports, scraping  |

### Why three services (not one)?
- **Different runtimes.** Python is the standard for AI/ML; Node is the standard for fast web APIs. Mixing inside one runtime would hurt both.
- **Different scaling profiles.** A burst of `/api/projects` requests should not delay a 20-minute video export.
- **Different security boundaries.** Workers may execute untrusted code (FFmpeg on user uploads, yt-dlp on user URLs) and live behind the API.

### Why not microservices for each AI feature?
Pre-product-market-fit, having dedicated services for transcription, TTS, exports, etc. multiplies operational cost. The `workers` app is one binary with multiple Celery queues, each routable to its own pool. We can split into separate services later by promoting a Celery queue to its own deployment without code changes.

## 3. Data flow: end-to-end example

A user uploads a 30-minute video, asks for AI highlights, generates a voiceover and captions, then exports a 9:16 short.

```
1.  Browser            → POST /api/projects (web → api)
2.  Browser            → POST /api/uploads/init  (presigned PUT to S3)
3.  Browser            → PUT https://s3/.../upload-id (direct to S3)
4.  Browser            → POST /api/projects/{id}/assets {key: ...} (registers upload)
5.  Browser            → POST /api/projects/{id}/generate/highlights
6.  api                → DB: insert AiJob row, status=queued
7.  api                → Broker: enqueue highlights task
8.  workers (highlights queue) consumes task
       ├─ download asset from S3
       ├─ FFmpeg: extract audio waveform + scene cuts
       ├─ compute highlight ranges
       ├─ store proposed Clips in DB
       └─ publish progress events to Redis pubsub
9.  api WebSocket pushes progress to browser
10. Browser            → POST /api/projects/{id}/generate/voice {script}
       ├─ workers (tts queue) → ElevenLabs API → upload audio to S3
       └─ create Voiceover row + Clip row on timeline
11. Browser            → POST /api/projects/{id}/transcribe
       ├─ workers (transcription queue) → Whisper → SRT
       └─ create Transcript row + Caption rows
12. Browser            → POST /api/projects/{id}/export
       ├─ workers (export queue) → FFmpeg compose pipeline
       │   (concat clips, overlay captions, mix voiceover, normalize loudness,
       │   re-encode to H.264, target 9:16 1080×1920)
       └─ upload result to S3, create Export row with download URL
13. Browser polls (or receives via WebSocket) and downloads.
```

## 4. Data plane

### 4.1 Primary store: PostgreSQL
- One Postgres cluster, single primary, optional read replicas.
- Owned exclusively by `apps/api`. Workers go through the API for writes, except for status updates on `AiJob` (allowed because of frequency).
- Schema is managed by **Prisma** (`packages/db/prisma/schema.prisma`). Migrations live in `packages/db/prisma/migrations/`.
- See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the table reference.

### 4.2 Cache & ephemeral state: Redis
- DB 0 — generic cache (rate-limit counters, OTP attempt counters, presigned URL cache).
- DB 1 — Celery/RQ job state if using Redis broker.
- DB 2 — Celery result backend.
- DB 3 — Pub/Sub for WebSocket progress updates.

### 4.3 Broker: RabbitMQ (default) or Redis (development)
- AI jobs flow through topic exchanges so each worker pool subscribes to a subset.
- Routing keys: `transcription.*`, `tts.*`, `highlights.*`, `image.*`, `video.*`, `export.*`, `import.*`.

### 4.4 Object storage: S3 (MinIO locally)
Buckets:
- `vrs-uploads` — user-uploaded raw files. Lifecycle: move to IA after 30 days, delete on user account deletion.
- `vrs-generated` — AI-generated audio, images, intermediate artifacts. TTL governed by plan.
- `vrs-exports` — final rendered videos. Served via signed CloudFront URLs.
- `vrs-public` — thumbnails, template previews. Public-read; cached at CDN.

All client uploads go **direct to S3** via presigned PUT URLs; the API never proxies binary payloads.

## 5. Authentication & sessions

- **Passwordless email + OTP** (6-digit, 10-minute TTL). Same flow for signup and login.
- OTP codes hashed (Argon2id) in Redis with attempt counters.
- On success, the API issues **two tokens**:
  - **Access token** — JWT, 15 min, returned to the browser as an `HttpOnly` cookie (`SameSite=Lax`, `Secure` in prod).
  - **Refresh token** — opaque, 30 days, server-side row in `RefreshToken` table, rotated on use.
- Internal service-to-service calls (workers ↔ API) use an `Internal-Service-Token` HMAC header.
- Optional OAuth (Google) follows the same JWT issuance after federation.
- Admins are flagged by `User.role = 'ADMIN'`; admin routes also require an extra session check (`adminVerifiedAt` within 24h).

## 6. Frontend architecture

- **Next.js 14, App Router, RSC where it makes sense.**
- Route groups:
  - `(marketing)` — landing, pricing, terms, privacy
  - `(auth)` — signin, signup, verify-otp
  - `(app)` — dashboard, projects, editor, templates, insights, settings, billing
  - `(admin)` — admin-only routes (separate layout, server-side role check)
- **State:** server components for data-fetching; client components for the editor (heavy interactive state managed by `zustand`).
- **Styling:** Tailwind CSS with design tokens in `packages/ui/src/tokens.css`.
- **Forms:** React Hook Form + Zod (schemas shared with backend via `packages/types`).
- **Video preview:** the editor uses HTML5 `<video>` with a custom multi-track compositor (canvas overlay for captions, audio track via WebAudio).
- **Real-time updates:** native `WebSocket` for job progress; falls back to polling.

## 7. Backend architecture

`apps/api` is a Fastify server organized in layers:

```
src/
├── routes/         HTTP route definitions (URL → controller binding)
├── controllers/    Request/response handling, validation (Zod)
├── services/       Business logic (one per domain: auth, projects, billing, …)
├── repositories/   Prisma queries (the only layer that touches DB)
├── jobs/           Job enqueueing helpers (talks to broker)
├── middleware/     auth, rate-limit, error, logging
├── lib/            Cross-cutting: logger, jwt, errors, schemas
├── config/         Env, DB, Redis, Stripe, S3 clients
└── plugins/        Fastify plugins (swagger, cors, helmet, multipart, websocket)
```

### Validation & contracts
- Every route declares its request/response shape with **Zod**. Schemas are exported from `packages/types` so the frontend and SDK reuse them.
- OpenAPI spec is auto-generated from the Zod schemas; served at `/docs`.

### Error model
All errors thrown inside the API extend `AppError`, which carries a stable error code, HTTP status, public message, and (optional) operational metadata. The global error handler converts them into a uniform envelope:

```json
{ "error": { "code": "PROJECT_NOT_FOUND", "message": "Project not found", "requestId": "..." } }
```

### Idempotency
Mutating endpoints accept an optional `Idempotency-Key` header. Keys are stored in Redis with the response for 24h; replay returns the cached response.

## 8. AI worker architecture

`apps/workers` is a Python package that exposes:

- A **FastAPI** admin server (`/health`, `/metrics`, `/queues`) for orchestration and observability.
- A **Celery app** with multiple queues, each backed by a worker process pool sized appropriately:
  - `transcription` — Whisper inference (GPU-preferred, CPU fallback).
  - `tts` — ElevenLabs / Polly / Azure HTTP clients (IO-bound, high concurrency).
  - `highlights` — FFmpeg + librosa for energy detection.
  - `image_gen` — Stability / Replicate / local SDXL (GPU-preferred).
  - `video_gen` — Runway / Pika (HTTP, gated by API quota).
  - `script_gen` — LLM client (Anthropic / OpenAI).
  - `import_url` — `yt-dlp` + S3 upload.
  - `export` — FFmpeg compose pipeline; the heaviest job.

Each worker reads/writes to Postgres via SQLAlchemy (separate from Prisma, but pointing at the same DB and the same physical tables — schemas pinned by alembic-mirror so drift is caught).

### Job lifecycle
1. API creates an `AiJob` row (`status='queued'`, `kind=…`, `payload=jsonb`).
2. API publishes a Celery task with the `job_id`.
3. Worker picks up, transitions to `running`, posts progress to Redis pubsub.
4. On completion: writes result rows (transcript, voiceover, etc.), updates `AiJob.status='succeeded'`.
5. API subscribes to pubsub and forwards to WebSocket clients.
6. Failures: `AiJob.status='failed'`, error metadata captured, retried with exponential backoff up to `AiJob.maxAttempts`.

## 9. Billing

- **Stripe** subscriptions with three plans: `FREE`, `CREATOR`, `BUSINESS`. Annual options for paid plans.
- Plan limits encoded in the `Plan` DB table — not hardcoded — so adjusting limits doesn't require deploys.
- Quotas tracked in `UsageRecord` (monthly counters: videos generated, voiceover characters, transcription minutes, export minutes).
- Stripe Webhooks (signed) update `Subscription` rows; the API enforces quotas at request time via the `usage.service`.
- **Cancel flow is one click** (a documented past-failure mode of the inspiration product). Cancellation triggers immediate "cancel at period end" via Stripe and an email confirmation.

See [`docs/BILLING.md`](docs/BILLING.md).

## 10. Observability

- **Structured logging** (pino in Node, structlog in Python) → stdout → CloudWatch / Loki.
- **Metrics** via Prometheus exporters on each app. Key SLI dashboards: API latency p50/p95/p99, queue depth per worker, AI job success rate, export duration.
- **Tracing** via OpenTelemetry. Trace IDs propagate across HTTP and broker boundaries via `traceparent` and `X-VRS-Trace-Id` headers.
- **Errors** to Sentry (separate projects per app).
- **Alerting** to PagerDuty for critical metrics (queue stuck, error rate spike, payment webhook backlog).

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## 11. Security posture

- HTTPS everywhere; HSTS with preload in production.
- Helmet (Node) / equivalent middleware sets CSP, X-Frame-Options, Referrer-Policy.
- Secrets in AWS Secrets Manager (production) or `.env` (local). Never in git, never in logs.
- Rate limiting on every public endpoint; tighter limits on auth and AI endpoints.
- Argon2id for OTP code hashes. JWT secrets ≥ 32 bytes.
- S3 buckets private by default; CloudFront with signed URLs for downloads.
- Workers run in an isolated subnet with egress allow-list (S3, AI providers, Stripe). No inbound from the internet.
- DMCA / abuse pipeline: a `Report` table + admin queue, content takedown audit log.
- See [`docs/SECURITY.md`](docs/SECURITY.md) for the full threat model.

## 12. Deployment

### Environments
- **local** — docker-compose, MinIO, Mailhog. Stripe in test mode.
- **dev** — single AWS account, single AZ, scale-to-zero. Hosted by Terraform `envs/dev`.
- **staging** — production parity, separate AWS account.
- **production** — multi-AZ, autoscaling, Stripe live.

### Pipeline
GitHub Actions:
1. **PR opened** → lint, typecheck, unit tests, build all images, Trivy scan.
2. **Merge to main** → integration tests on temporary RDS snapshot, deploy to `dev` via Terraform Cloud.
3. **Tag `vX.Y.Z`** → deploy to `staging`, manual approval gate, deploy to `production`.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## 13. Scaling strategy

| Component  | First bottleneck       | Mitigation                                                                   |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- |
| Web (Next) | SSR CPU                | Horizontal autoscale on CPU; cache marketing pages at CDN                   |
| API        | DB connections         | PgBouncer in transaction mode; tune Prisma pool                              |
| Postgres   | Write throughput       | Read replicas for dashboard; archive cold projects                           |
| Redis      | Memory                 | Eviction policy `volatile-lru`; promote OTP storage to its own instance      |
| Broker     | Queue length           | Per-queue worker autoscaling on lag; dead-letter queue                       |
| Workers    | GPU availability       | GPU pool with priority queue; spot instances for non-export jobs             |
| S3         | n/a                    | Lifecycle rules to IA / Glacier for cold uploads                             |
| CloudFront | n/a                    | CDN handles the bulk of bandwidth                                            |

## 14. Decision log

Architectural decisions are documented as [ADRs](docs/adr/) numbered sequentially. Existing decisions:

| #    | Title                                              | Status   |
| ---- | -------------------------------------------------- | -------- |
| 0001 | Adopt monorepo with Turborepo + pnpm               | Accepted |
| 0002 | Choose Next.js + Fastify (TS) + Python workers     | Accepted |
| 0003 | Use Prisma as the canonical ORM                    | Accepted |
| 0004 | Passwordless auth via email OTP                    | Accepted |
| 0005 | Provider-agnostic AI integrations via env config   | Accepted |

When in doubt about a design, write an ADR first.
