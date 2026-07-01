# Progress

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Caption editor + publish targets + support tickets + Google sign-in + legal + test infra. Repo runnable.

## Roadmap

### Phase 0 — Foundation
All ✅. Terraform network / database / cache / storage / ecs-service modules + dev + prod envs. Prom metrics `/metrics`.

### Phase 1 — Auth & users
| Module | Status |
| --- | --- |
| OTP request + verify | ✅ |
| JWT + rotated refresh | ✅ |
| Session middleware | ✅ |
| Sign-in / verify pages | ✅ |
| Google OAuth sign-in | ✅ |
| Profile, session list, delete account | ✅ |
| Audit log on auth events | ✅ |

### Phase 2 — Projects & assets
All ✅.

### Phase 3 — Editor
| Module | Status |
| --- | --- |
| Timeline persistence (tracks + clips) | ✅ |
| Undo/redo command history | ✅ |
| Autosave (diff-based) | ✅ |
| Sidebar tools wired to real AI | ✅ |
| Caption editor (segments + style panel) | ✅ |
| WebSocket job progress | ✅ |
| Multi-track / split-screen UI adder | 🟡 |

### Phase 4 — AI
All ✅. Endpoints: highlights/transcribe/voice/script/rewrite/image/video/thumbnail/export. Voice-clone worker + ElevenLabs. Publish workers (YouTube resumable, TikTok chunked).

### Phase 5 — Export & publish
| Module | Status |
| --- | --- |
| Multi-track FFmpeg compose | ✅ |
| Export status page | ✅ |
| Render presets | ✅ |
| Caption burn-in (libass) | ✅ |
| Publish OAuth (YouTube, TikTok) | ✅ |
| Publish worker | ✅ |
| Publish target management UI | ✅ |
| Publish action on export status page | ⬜ |

### Phase 6 — Billing & quotas
All ✅.

### Phase 7 — Analytics & insights
| Module | Status |
| --- | --- |
| Personal insights page | ✅ |
| YouTube external stats import | ⬜ |
| Video-ranking comparison workflow | ⬜ |

### Phase 8 — Admin & operations
| Module | Status |
| --- | --- |
| Admin metrics, users, subs, abuse, tickets, flags, audit | ✅ |
| Support ticket reply thread (user + admin) | ✅ |

### Phase 9 — Production readiness
| Module | Status |
| --- | --- |
| Terraform (VPC/RDS/ElastiCache/S3/ECS) | ✅ |
| Prometheus /metrics | ✅ |
| Runbooks / Deployment / Observability / Security docs | ✅ |
| Legal pages (terms / privacy / DMCA) | ✅ |
| Vitest test infra + integration tests (auth, health) | ✅ |
| Unit tests (errors, queue serialisation) | ✅ |
| Workers pytest (compose graph) | ✅ |
| Playwright E2E scaffold + smoke suite | ✅ |
| k6 load test scaffold | ✅ |
| Sentry + OTel full instrumentation | 🟡 |
| Grafana dashboards | ⬜ |
| CloudFront + Route53 Terraform modules | ⬜ |

## Per-session log

### Session 5 — Captions, publishing, sign-in, support, legal, tests

**Landed:**

- **Captions API**: full transcript segment CRUD, per-project Caption rows with style JSON + segments JSON, auto-recomputed content text.
- **Caption editor UI**: editable transcript timeline, style panel (font/size/color/outline/position/animation), preview bubble, .srt / .vtt download. Wired into the Captions sidebar as a second sub-panel.
- **Publish**:
  - AES-256-GCM encrypted token storage in `publish.service.ts`
  - OAuth flows for YouTube + TikTok with Redis-backed state (10-min TTL)
  - `POST /v1/publish` enqueues per-provider Celery task
  - Worker: YouTube resumable-upload + TikTok chunked-upload, both post PUBLISHED/FAILED via internal callback
  - New "publish" queue in celery_app.py; TASK_ROUTES synchronised in the Node queue.service.ts
  - `/settings/publishing` connect/disconnect UI with provider cards
- **Google sign-in**: `GET /v1/auth/google/{authorize,callback}`, upserts Account row, backfills avatar, issues session. Sign-in page gains a Continue-with-Google button.
- **Support tickets**: user-facing list (`/support`), create form (`/support/new`), thread view (`/support/[id]`). Server enforces staff-only internal-message visibility. Audit hooks on every ticket action.
- **Legal**: `/legal/terms`, `/legal/privacy`, `/legal/dmca` — original copy.
- **Testing**:
  - Vitest config for `apps/api` with a real Postgres + Redis integration profile
  - `test/helpers/db.ts` (transactional TRUNCATE reset + plan seed) + `helpers/app.ts` (Fastify inject harness)
  - Integration tests: `/health`, OTP request/verify with real Argon2 verification
  - Unit tests: AppError factory shapes, Celery wire-protocol serialisation
  - Playwright config + smoke suite (landing, sign-in surface, legal pages)
  - k6 load-test scaffold under `infrastructure/loadtests/api.js` targeting root/health/plans with p95<800ms
  - Workers pytest covering compose-graph shape + atempo-chain edge cases

**Next queue (priority order):**

1. Publish action on the export status page + publish jobs history at `/publish/history`.
2. Video-ranking workflow (batch import + A/B compare + ranked export).
3. YouTube external stats import for insights.
4. Multi-track / split-screen "add track" UI adder.
5. CloudFront + Route53 Terraform module.
6. Grafana dashboard JSON artifacts.
7. Full Sentry + OTel trace propagation across HTTP + broker + worker.
8. Content moderation classifier (defence-in-depth for AI generation prompts).
9. Admin ticket-reply thread reuse (admin/tickets/[id] page).
10. Notification centre in nav bar (bell icon with unread count).

**Historical session logs preserved in `git log`.**
