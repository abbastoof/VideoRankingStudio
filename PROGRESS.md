# Progress

This document tracks per-module completion across sessions. **First thing to read when picking up the project.**

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Auth → projects → uploads → editor MVP → billing all wired end-to-end. Repo is runnable.

## Roadmap

### Phase 0 — Foundation
| Module | Status | Notes |
| --- | --- | --- |
| Monorepo skeleton | ✅ | pnpm workspaces + Turborepo |
| Top-level docs | ✅ | README, ARCHITECTURE, CONTRIBUTING, SECURITY |
| `.env.example` | ✅ | Every subsystem documented |
| Shared config / types / ui / db | ✅ | 4 packages, all consumed by apps |
| Shared SDK (`@vrs/sdk`) | ✅ | Typed client used by web for every endpoint |
| Database schema (Prisma) | ✅ | ~35 models, indexed |
| Seed (plans, voices, templates) | ✅ | |
| Docker Compose dev infra | ✅ | postgres / redis / minio / rabbitmq / mailhog |
| API skeleton | ✅ | Fastify, plugins, swagger, ws |
| Web app skeleton | ✅ | Next.js 14 App Router + design system |
| Workers (Celery + FastAPI) | ✅ | 8 tasks registered, real provider routing |
| CI workflow + Dockerfiles | ✅ | Lint/typecheck/test/build/Trivy + 3 prod Dockerfiles |
| Terraform skeleton | ⬜ | Phase 9 work |

### Phase 1 — Auth & users
| Module | Status | Notes |
| --- | --- | --- |
| OTP request + verify | ✅ | `/v1/auth/otp/{request,verify}` |
| JWT + opaque refresh, rotation | ✅ | |
| Session middleware | ✅ | `requireAuth`, `requireAdmin`, `requireInternal` |
| Sign-in / verify pages | ✅ | |
| Dashboard | ✅ | Stats + onboarding + template picker |
| Profile form (UI) | ✅ | Saves locally; `PATCH /v1/users/me` endpoint pending |
| Audit log writes | ⬜ | |
| OAuth (Google) | ⬜ | |

### Phase 2 — Projects & assets
| Module | Status | Notes |
| --- | --- | --- |
| Project CRUD (`POST/GET/PATCH/DELETE /v1/projects`, `/duplicate`) | ✅ | with usage quota enforcement |
| Presigned upload (`POST /v1/uploads/init`, `/complete`) | ✅ | direct PUT to S3 |
| URL import (`POST /v1/uploads/import`) | ✅ | enqueues worker job |
| Asset CRUD (`GET /v1/assets`, `GET /v1/assets/:id`) | ✅ | presigned URLs on read |
| Internal callback routes | ✅ | `PATCH /v1/internal/jobs/:id`, `GET /v1/internal/projects/:id/timeline`, finished-handlers for assets/transcripts/voiceovers/exports |
| Projects list page | ✅ | Search, status badges, paginated |
| New-project wizard | ✅ | Upload / URL / Script flows; template flow routes to `/templates` |
| Templates page | ✅ | Categories tab bar; clicking creates a project |

### Phase 3 — Editor MVP
| Module | Status | Notes |
| --- | --- | --- |
| Timeline state store (zustand) | ✅ | clips, tracks, zoom, playhead, dirty flag |
| Timeline lane component | ✅ | drag/move/trim, scene cuts via 'B' key, delete |
| Preview pane | ✅ | HTML5 video, sync to playhead, fullscreen, mute, caption overlay |
| Sidebar tools | ✅ | Media uploader, URL import, generate captions/highlights/voice/script/image |
| Toolbar | ✅ | Save, export, undo/redo, zoom in/out |
| Editor server page | ✅ | `/projects/[id]` loads project + renders shell |
| Keyboard shortcuts | ✅ | Space / B / Delete / arrows / +/- |
| Clip mutation REST endpoints | ⬜ | Next session — persist timeline changes |
| Undo/redo (command log) | ⬜ | |
| Multi-track + split-screen layouts | ⬜ | |

### Phase 4 — AI features
| Module | Status | Notes |
| --- | --- | --- |
| Highlights worker | ✅ | FFmpeg energy + scene cuts |
| Transcription worker | ✅ | OpenAI Whisper / faster-whisper / Deepgram |
| TTS worker | ✅ | ElevenLabs / Polly |
| Script generate + rewrite worker | ✅ | Anthropic + OpenAI |
| Image gen worker | ✅ | Stability + Replicate |
| URL import worker | ✅ | yt-dlp |
| Export render worker | 🟡 | FFmpeg single-clip path; compose graph next |
| Thumbnail worker | ✅ | |
| `POST /v1/projects/:id/generate/*` route surface | ⬜ | Workers reachable but not yet exposed via authed endpoints |
| Video generation | ⬜ | Provider toggle in env (`VIDEO_GEN_PROVIDER`); worker pending |

### Phase 5 — Export & publish
| Module | Status | Notes |
| --- | --- | --- |
| `POST /v1/projects/:id/export` route | ⬜ | Next session |
| Export status WS push | 🟡 | WebSocket wired (`/v1/ws/projects/:id`); export-specific events land with the export route |
| Caption burn-in + animation | ⬜ | |
| Loudness normalization | ✅ | Wired in worker |
| Watermark for free plan | ✅ | drawtext fallback; brand-mark overlay variant pending |
| Direct publish (YouTube/TikTok) | ⬜ | Schema ready |

### Phase 6 — Billing & quotas
| Module | Status | Notes |
| --- | --- | --- |
| Stripe customer + subscription | ✅ | `ensureStripeCustomer`, `startCheckout`, `openPortal`, `cancelActiveSubscription` |
| Plan catalog + price routing | ✅ | env-driven price IDs per plan/interval |
| Webhook handler + signature verify | ✅ | subscription.* + invoice.* + checkout.session.completed |
| Usage middleware + quota enforcement | ✅ | `assertWithinLimit`, monthly UsageRecord, plan-driven limits |
| Billing UI | ✅ | Plans grid, current usage bars, invoice history, upgrade / portal / cancel |
| Settings UI | ✅ | Profile form + security placeholder |

### Phase 7 — Analytics & insights
*(unchanged — all ⬜)*

### Phase 8 — Admin & operations
*(unchanged — all ⬜)*

### Phase 9 — Production readiness
| Module | Status | Notes |
| --- | --- | --- |
| Terraform (VPC / ECS / RDS / ElastiCache / S3 / CF / ACM / R53) | ⬜ | |
| Helm/K8s manifests | ⬜ | |
| Sentry, OTel, Prometheus dashboards | 🟡 | DSNs/exporters wired in code, dashboards pending |
| Runbooks | ⬜ | |
| Load tests (k6) + chaos drills | ⬜ | |
| Compliance docs (privacy/ToS/DMCA) | ⬜ | |

## Per-session log

### Session 2 — Projects, uploads, editor MVP, billing
**Landed:**
- **`@vrs/sdk`** — fully typed API client (auth, projects, uploads, assets, templates, billing). Server + client variants under `apps/web/src/lib/{sdk,client-sdk}.ts`.
- **Project CRUD** end-to-end:
  - Repository (`apps/api/src/repositories/projects.repo.ts`) with cursor pagination, list filters, soft delete, deep-copy duplicate (clones tracks + clips).
  - Service (`projects.service.ts`) with quota enforcement on create/duplicate.
  - Routes (`projects.routes.ts`) for list / create / get / patch / delete / duplicate.
- **Usage service + quota middleware** — `UsageRecord`-backed monthly counters, plan-driven limits, error mapping (`PROJECT_LIMIT_REACHED`, `VOICEOVER_QUOTA_EXCEEDED`, etc.).
- **Uploads**:
  - `POST /v1/uploads/init` returns presigned PUT URL after creating a `PENDING_UPLOAD` Asset.
  - `POST /v1/uploads/complete` HEADs S3 to confirm, marks `UPLOADED`, enqueues thumbnail.
  - `POST /v1/uploads/import` creates a `PROCESSING` Asset and enqueues `vrs.import.url`.
- **Internal routes** (`/v1/internal/*`): worker-only, HMAC-token-guarded.
  - `PATCH /jobs/:id` — workers set RUNNING / SUCCEEDED / FAILED / RETRYING.
  - `GET /projects/:id/timeline` — export worker fetches a full timeline.
  - `POST /assets/:id/done`, `/transcripts/done`, `/voiceovers/:id/done`, `/exports/:id/done` — close the loop on each worker outcome.
- **Jobs service** (`jobs.service.ts`) — wraps Celery enqueue with idempotency keys + structured logging.
- **Queue service** (`queue.service.ts`) — speaks Celery v2 wire protocol over either Redis (`LPUSH`) or RabbitMQ (`amqplib`, lazy-loaded) so the broker is env-switchable.
- **WebSocket** (`/v1/ws/projects/:id`) — subscribes to Redis pubsub `vrs:job:*`, filters to the project's job IDs, forwards to authed client.
- **Templates routes** — list + get-by-slug with presigned thumbnails/previews.
- **Stripe billing**:
  - Service: customer provisioning, checkout, billing portal, cancel-at-period-end, webhook ingestion with WebhookDelivery audit (replay-safe).
  - Routes: plans catalog, current subscription, usage summary, invoices, checkout, portal, cancel, webhook (signature verified).
- **Web app**:
  - Projects list — server-rendered, search, pagination, status badges, empty state.
  - New-project wizard — Upload / URL / Script flows; real presigned upload with XHR progress.
  - Templates gallery — category tabs, click-to-create.
  - Project editor at `/projects/[id]` — full editor shell.
  - **Editor MVP**: zustand store, draggable + trimmable timeline clips, ruler with click-to-seek, playhead overlay, preview pane that scrubs an HTML5 `<video>` to the playhead, caption overlay, sidebar tools (Media / Highlights / Captions / Voice / Script&Image), toolbar with Save/Export/Undo/Redo/Zoom, keyboard shortcuts (Space, B, Delete, arrows, +/-).
  - Billing page — plans grid, current usage bars, invoices, upgrade/portal/cancel buttons.
  - Settings page — profile form, security placeholder.

**Resume points for next session, in order:**

1. **Clip mutation REST endpoints** — `POST/PATCH/DELETE /v1/projects/:id/tracks/:trackId/clips` so the editor persists its timeline state instead of only living in zustand.
2. **`POST /v1/projects/:id/generate/{highlights,transcribe,voice,script,image,export}`** — authed endpoints that enqueue the existing worker tasks. Then plumb the WS progress events into the editor sidebar buttons.
3. **`PATCH /v1/users/me`** — back the settings form properly; add session-list/revoke endpoints.
4. **Audit log writes** — every auth + billing event lands a row.
5. **Export status page** at `/projects/[id]/exports/[exportId]` with WS progress + download link when ready.
6. **Admin console** — `/admin` route group, user/sub list, abuse/ticket queues; protect with role check already present in `AppShell`.
7. **OAuth (Google)** — schema already supports it; finish provider plumb-through.
8. **Terraform** — VPC, ECS, RDS, ElastiCache, S3, CloudFront, ACM, Route53.

**Notes for resuming:**
- `make setup` + `pnpm dev` boots the whole stack locally.
- The API serves Swagger at `http://localhost:4000/docs` in non-prod.
- The SDK is the contract between web and API — keep it in sync as routes evolve.
- The editor store lives at `apps/web/src/state/editor-store.ts`. Timeline persistence is the next dependency to clear.
- Stripe is fully wired but waits on real `STRIPE_*` env vars before it can issue real checkouts.
- Brand stays amber/gold, Inter / JetBrains Mono, "stacked play triangle" mark.
