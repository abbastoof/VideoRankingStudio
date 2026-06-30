# Progress

This document tracks per-module completion across sessions. **First thing to read when picking up the project.**

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Foundation + auth + workers + CI + Dockerfiles. Ready to build feature pages and admin/billing.

## Roadmap

### Phase 0 — Foundation
| Module | Status | Notes |
| --- | --- | --- |
| Monorepo skeleton | ✅ | pnpm workspaces + Turborepo |
| Top-level docs | ✅ | README, ARCHITECTURE, CONTRIBUTING, SECURITY, LICENSE, CODEOWNERS |
| `.env.example` | ✅ | Every subsystem documented |
| Shared config package (`@vrs/config`) | ✅ | ESLint + TS + Tailwind presets |
| Shared types package (`@vrs/types`) | ✅ | Zod schemas: common/api/auth/users/projects/clips/assets/transcripts/voices/jobs/exports/templates/billing/admin/notifications |
| Database schema (Prisma) | ✅ | ~35 models; full enum coverage; indexed |
| Seed data | ✅ | Plans, stock voices, templates, dev admin |
| Prisma client + helpers | ✅ | Transactional helper, cursor pagination, tryFind |
| `docker-compose.yml` | ✅ | postgres / redis / minio / rabbitmq / mailhog + init scripts |
| UI package (`@vrs/ui`) | ✅ | Tokens, Button, Input, Card, Spinner, Badge, Toast |
| API service skeleton | ✅ | Server boots; env-validated; structured logging |
| Web app skeleton | ✅ | Next.js 14 App Router, design system wired, route groups |
| Workers service | ✅ | Celery + FastAPI; 8 tasks registered with real provider routing |
| CI workflow (`.github/workflows/ci.yml`) | ✅ | Lint, typecheck, test, build, image push to GHCR, Trivy scan |
| Production Dockerfiles | ✅ | api / web (standalone) / workers (ffmpeg + yt-dlp) |
| Terraform skeleton | ⬜ | Phase 9 work |

### Phase 1 — Auth & users
| Module | Status | Notes |
| --- | --- | --- |
| OTP request + verify endpoints | ✅ | `/v1/auth/otp/{request,verify}` |
| JWT access/refresh tokens, rotation, revocation | ✅ | Argon2id-hashed OTP; opaque rotated refresh tokens |
| Session middleware (Fastify) | ✅ | `requireAuth`, `requireAdmin`, `requireInternal` |
| Email delivery | ✅ | SMTP / SendGrid / SES switchable; original templates |
| Rate limiting on auth endpoints | ✅ | Per-route override |
| Sign-in page | ✅ | `(auth)/signin` with `react-hook-form` + zod resolver |
| Verify-OTP page | ✅ | 6-digit input, resend cooldown, paste handler |
| App shell + dashboard | ✅ | `(app)/layout.tsx` + `(app)/dashboard/page.tsx` |
| Profile + settings UI | ⬜ | Next session |
| Audit log writes for auth events | ⬜ | |
| OAuth (Google) | ⬜ | Schema already supports it |

### Phase 2 — Projects & assets
| Module | Status | Notes |
| --- | --- | --- |
| Project CRUD endpoints | ⬜ | Types ready in `@vrs/types/projects` |
| Presigned-upload flow | ⬜ | Types ready in `@vrs/types/assets` |
| URL import endpoint (worker side) | ✅ | `vrs.import.url` task; yt-dlp wrapped |
| Projects list page (with search/filter) | ⬜ | |
| New-project wizard | ⬜ | |
| Templates catalog + page | ⬜ | DB seeded, page pending |

### Phase 3 — Editor (timeline)
*(unchanged — all ⬜)*

### Phase 4 — AI features
| Module | Status | Notes |
| --- | --- | --- |
| Highlight detection worker | ✅ | FFmpeg audio energy + scene cuts; ranked windows |
| Whisper-based transcription | ✅ | OpenAI / faster-whisper / Deepgram providers |
| Caption editor + SRT export | 🟡 | Worker emits SRT/VTT; UI pending |
| TTS voiceover (ElevenLabs / Polly / Azure) | ✅ | Provider-switchable via env |
| Voice cloning | ⬜ | Endpoint + worker pending |
| Script generation + rewrite (LLM) | ✅ | Anthropic + OpenAI adapters |
| Image generation (Stability / Replicate) | ✅ | |
| Video generation | ⬜ | Provider stubs in `apps/workers/src/vrs_workers/tasks/video_gen.py` next session |

### Phase 5 — Export & publish
| Module | Status | Notes |
| --- | --- | --- |
| Export job builder | 🟡 | `vrs.export.render` task with FFmpeg single-clip path; full compose graph pending |
| Caption burn-in + animation | ⬜ | |
| Loudness normalization (EBU R128) | ✅ | `loudnorm` filter wired |
| Watermark for free plan | ✅ | `drawtext` overlay; brand-mark overlay variant pending |
| Direct publish to YouTube / TikTok | ⬜ | `PublishTarget` + `PublishJob` schema ready |

### Phase 6 — Billing & quotas
| Module | Status | Notes |
| --- | --- | --- |
| Stripe customer + subscription provisioning | ⬜ | env vars wired |
| Plan + price catalog seeded | ✅ | 4 plans, limits, features |
| Webhook handler | ⬜ | |
| Usage middleware | ⬜ | |
| Billing UI | ⬜ | |
| Customer portal embed | ⬜ | |

### Phase 7 — Analytics & insights · Phase 8 — Admin & operations · Phase 9 — Production readiness
*(unchanged — all ⬜)*

## Per-session log

### Session 1 — Foundation, auth, workers, CI/CD
**Landed:**
- Complete monorepo (pnpm + turbo), shared configs, all top-level docs.
- Complete Prisma schema (~35 models) + seed (plans, voices, templates, dev admin).
- Docker Compose dev infra (postgres / redis / minio / rabbitmq / mailhog).
- Shared packages: `@vrs/db`, `@vrs/types`, `@vrs/config`, `@vrs/ui`.
- UI foundation: amber design tokens (light + dark), Button/Input/Card/Spinner/Badge/Toast.
- **API service**: Fastify server, env-validated, structured logging (pino + redaction), AppError hierarchy, Argon2id-hashed OTP with resend cooldown, JWT + opaque-rotated refresh sessions, full auth route surface (`/v1/auth/otp/{request,verify}`, `/refresh`, `/signout`, `/session`), email service (SMTP/SendGrid/SES) with original templates.
- **Web app**: Next.js 14 App Router, design system wired, landing page (original copy), `(auth)` flow (sign-in + 6-digit verify with paste/keyboard nav), `(app)` shell with sidebar nav, dashboard.
- **Workers**: Python + Celery, multi-queue routing, FastAPI admin (`/health`, `/health/ready`, `/queues`), real implementations for transcription (Whisper / faster-whisper / Deepgram), TTS (ElevenLabs / Polly), highlight detection (FFmpeg + numpy), script generate + rewrite (Anthropic / OpenAI), image generation (Stability / Replicate), URL import (yt-dlp), export render (FFmpeg single-clip path), thumbnails.
- **CI**: GitHub Actions — Node lint/typecheck/test/build, Python lint/test, container image build & push to GHCR, Trivy scan.
- **Production Dockerfiles**: api (multi-stage, non-root, healthcheck), web (Next.js standalone), workers (ffmpeg + yt-dlp baked).

**Resume points for next session, in order:**

1. **Project CRUD** in API: `routes/projects.routes.ts`, `services/projects.service.ts`, `repositories/projects.repo.ts`. DTOs already in `@vrs/types`. Wire `POST /v1/projects`, `GET /v1/projects`, `GET /v1/projects/:id`, `PUT /v1/projects/:id`, `DELETE /v1/projects/:id`. Bump `User.projectsCount` on create/delete.
2. **Presigned upload flow**: `routes/uploads.routes.ts` + `services/storage.service.ts` (`createMultipartUpload`, `presignedPut`, `completeUpload`). DTOs in `@vrs/types/assets`. After client finishes upload, register the asset and (optionally) enqueue a thumbnail job.
3. **Internal callback routes**: `/v1/internal/jobs/:id` (PATCH) so the workers' `api_client.update_job` actually works. Guarded by `requireInternal` middleware. Also `/v1/internal/projects/:id/timeline` for the export task.
4. **Web: Projects list + New-project wizard**: `/app/(app)/projects/page.tsx` and `/projects/new/page.tsx`. Use the design system; fetch via the `api` client + TanStack Query.
5. **Internal SDK package**: `packages/sdk` (typed `@vrs/sdk` against the API) so the web app stops hand-coding URLs.
6. **Templates page**: server-fetched from the seeded `Template` table, rendered as a grid; click → create project with `templateId`.
7. **Editor MVP**: timeline data model (already in schema) → state store (zustand) → drag/drop with `dnd-kit` → preview compositor with `<video>` + canvas overlay.
8. **Stripe billing**: customer creation on first paid action, checkout, customer portal, webhook handler, usage middleware.

**Notes for resuming:**
- All env vars are documented in `.env.example`.
- `make setup` runs first-time provisioning end-to-end.
- The API boots today with `pnpm --filter @vrs/api dev` after `pnpm db:migrate && pnpm db:seed`.
- The schema is the source of truth — never bypass Prisma migrations.
- Worker task callbacks expect the internal callback endpoint (item 3 above) to exist before they can fully close the loop. Until that lands, jobs run successfully but the DB rows stay `RUNNING` from the worker's perspective.
- Brand is "VideoRankingStudio" with an amber/gold accent (#F5A70B core, full `--color-brand-*` ramp in `packages/ui/src/tokens.css`). Logo is a stacked-triangle "play" mark — see `apps/web/src/components/Logo.tsx`.
