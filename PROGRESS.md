# Progress

This document tracks per-module completion across sessions. **First thing to read when picking up the project.**

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Full timeline + AI + billing + admin + insights + Terraform + observability all wired end-to-end. Repo is runnable.

## Roadmap

### Phase 0 — Foundation
| Module | Status | Notes |
| --- | --- | --- |
| Monorepo skeleton | ✅ | pnpm workspaces + Turborepo |
| Top-level docs | ✅ | README, ARCHITECTURE, CONTRIBUTING, SECURITY, DEPLOYMENT, OBSERVABILITY, RUNBOOKS |
| `.env.example` | ✅ | Every subsystem documented |
| Shared config / types / ui / db / sdk | ✅ | 5 packages |
| Database schema (Prisma) | ✅ | ~35 models, indexed |
| Seed (plans, voices, templates) | ✅ | |
| Docker Compose dev infra | ✅ | postgres / redis / minio / rabbitmq / mailhog |
| API skeleton | ✅ | Fastify, plugins, swagger, ws, `/metrics` |
| Web app skeleton | ✅ | Next.js 14 App Router + design system |
| Workers (Celery + FastAPI) | ✅ | 10 tasks registered |
| CI workflow + Dockerfiles | ✅ | Lint/typecheck/test/build/Trivy + 3 prod Dockerfiles |
| Terraform (dev + production envs) | ✅ | network/database/cache/storage/ecs-service modules, dev + prod env manifests |

### Phase 1 — Auth & users
| Module | Status | Notes |
| --- | --- | --- |
| OTP request + verify | ✅ | |
| JWT + opaque refresh rotation | ✅ | |
| Session middleware | ✅ | `requireAuth`, `requireAdmin`, `requireInternal` |
| Sign-in / verify pages | ✅ | |
| Dashboard | ✅ | |
| Profile form (UI) + `PATCH /v1/users/me` | ✅ | |
| Session list + revoke endpoints | ✅ | |
| Delete account (soft, 30-day grace) | ✅ | |
| Audit log writes | ✅ | Auth + billing + admin events |
| OAuth (Google) | ⬜ | Schema already supports it |

### Phase 2 — Projects & assets
*(all ✅ from Session 2/3)*

### Phase 3 — Editor (timeline)
| Module | Status | Notes |
| --- | --- | --- |
| Timeline persistence (tracks + clips REST) | ✅ | full CRUD, split, move, batched reorder |
| Autosave with optimistic updates | ✅ | debounced diff-based sync |
| Undo/redo command history | ✅ | 200-entry ring buffer |
| Timeline editor UI | ✅ | drag/trim/split, ruler, playhead |
| Preview pane | ✅ | HTML5 video, caption overlay, fullscreen |
| Sidebar tools wired to real AI | ✅ | highlights/captions/voice/script/image |
| WebSocket job stream + JobProgressStrip | ✅ | |
| Multi-track + split-screen | 🟡 | schema + compose support it; UI adder pending |

### Phase 4 — AI features
| Module | Status | Notes |
| --- | --- | --- |
| Highlights / transcription / TTS / script / image / video / thumbnail workers | ✅ | provider-switchable via env |
| URL import worker | ✅ | yt-dlp |
| Voice-clone worker | ✅ | ElevenLabs adapter; internal callback route wired |
| `POST /v1/projects/:id/generate/*` + `POST /export` | ✅ | all quota-aware |
| `GET /v1/jobs/:id`, cancel, retry | ✅ | |
| Voices list + clone endpoints | ✅ | |

### Phase 5 — Export & publish
| Module | Status | Notes |
| --- | --- | --- |
| Multi-track FFmpeg compose graph | ✅ | trim/scale/opacity/z-order overlays + atempo chain + sidechain-ducked music + libass captions + watermark + EBU R128 |
| Export status page | ✅ | live WS + polling, download, retry |
| Render presets | ✅ | shorts 1080/720, square, landscape 1080p/4K |
| Caption burn-in | ✅ | Static; word-by-word animation pending |
| Watermark for free plan | ✅ | |
| Direct publish (YouTube / TikTok / Instagram) | ⬜ | Schema ready |

### Phase 6 — Billing & quotas
*(all ✅)*

### Phase 7 — Analytics & insights
| Module | Status | Notes |
| --- | --- | --- |
| Personal insights (`/insights`) | ✅ | range selector, RED chart, top projects |
| YouTube import for external stats | ⬜ | |
| Video-ranking workflow UI | ⬜ | |

### Phase 8 — Admin & operations
| Module | Status | Notes |
| --- | --- | --- |
| Admin metrics dashboard | ✅ | totals + MRR + backlog |
| User list + management | ✅ | role/status/plan changes, revoke sessions |
| Subscription list | ✅ | |
| Abuse queue | ✅ | listing; resolution actions in API, UI action bar pending |
| Support tickets | ✅ | listing; reply thread UI pending |
| Feature flags | ✅ | live toggle + rollout % |
| Audit log viewer | ✅ | filterable |
| Content moderation queue | 🟡 | Reuses abuse queue |
| Support ticket reply UI | ⬜ | |

### Phase 9 — Production readiness
| Module | Status | Notes |
| --- | --- | --- |
| Terraform (VPC / RDS / ElastiCache / S3 / ECS) | ✅ | dev + production compositions |
| ALB + HTTPS listener + redirect | ✅ | production env |
| Helm/K8s manifests | ⬜ | Optional; ECS-first |
| Prometheus `/metrics` on API | ✅ | prom-client lazy-loaded, RED per route |
| Sentry, OTel wiring | 🟡 | DSNs consumed; instrumentation partial |
| Grafana dashboards | ⬜ | Committed JSON artifacts pending |
| Runbooks | ✅ | `docs/RUNBOOKS.md` |
| Deployment guide | ✅ | `docs/DEPLOYMENT.md` |
| Observability guide | ✅ | `docs/OBSERVABILITY.md` |
| Security threat model | ✅ | `docs/SECURITY.md` |
| Load tests (k6) + chaos drills | ⬜ | |
| Compliance docs (privacy/ToS/DMCA legal) | ⬜ | Legal review needed |

## Per-session log

### Session 3 — Timeline persistence + AI endpoint surface + compose graph
*(see previous PROGRESS entry)*

### Session 4 — Admin, audit, insights, Terraform, observability

**Landed:**

- **Audit logging** (`audit.service.ts`) — fire-and-forget writer, error-suppressed. Hooks on: `auth.otp.requested`, `auth.signed_in`, `billing.checkout.started`, `billing.subscription.canceled`, `admin.user.updated`, `admin.user.sessions_revoked`, `admin.abuse.*`, `admin.flag.updated`.
- **Admin routes** — `/v1/admin/metrics`, `/users(/:id)` (list/detail/patch/revoke-sessions), `/subscriptions`, `/abuse-reports(/:id)`, `/tickets`, `/flags(/:id)`, `/audit` (paginated).
- **Insights routes** — `/v1/insights/overview` returns projects/exports/avg-render-time/jobs-by-kind/exports-by-day/top-projects via raw SQL aggregates.
- **Internal routes** — added `GET /internal/assets/:id` (worker asset lookup) and `POST /internal/voices/:id/trained` (voice-clone completion callback).
- **Web admin console** — role-gated `(app)/admin` route group with 7 pages: dashboard, users, subscriptions, abuse, tickets, flags, audit. Each is a proper table with server-rendered data + optional live-save actions.
- **Web insights** — user-facing `/insights` page with range selector, stat cards, per-day bar chart, per-kind horizontal bars, top-projects list.
- **Voice-clone worker** — `voice_clone.py`: fetches sample assets via `/internal/assets/:id`, transcodes to mono/22050 PCM with silence trim, calls ElevenLabs `voices/add`, posts `/internal/voices/:id/trained` with the returned provider ID.
- **Terraform** — full modules (`modules/network`, `modules/database`, `modules/cache`, `modules/storage`, `modules/ecs-service`) plus two environment compositions (`envs/dev`, `envs/production`). Production includes multi-AZ, Aurora Serverless v2 (1–16 ACU), 3-node Redis, ALB with TLS 1.3 + HTTP→HTTPS redirect, deletion protection everywhere.
- **Observability** — `apps/api/src/lib/metrics.ts` — prom-client lazy-loaded, RED metrics per route + `vrs_api_ai_jobs_enqueued_total` counter. `/metrics` endpoint auto-registered. `prom-client` added to `apps/api/package.json`.
- **Docs** — `docs/DEPLOYMENT.md`, `docs/OBSERVABILITY.md`, `docs/RUNBOOKS.md` (8 concrete playbooks), `docs/SECURITY.md` (threat model + secrets rotation + compliance stance).
- **SDK** — added admin*, insightsOverview methods.

**Next-session queue (highest priority first):**

1. **Caption editor UI** — transcript segments become editable timeline blocks; style panel (font/color/position/animation); tie live edits to `Transcript.segments` mutations. This unlocks the "word-by-word animation" export path.
2. **Publish targets** — OAuth flows for YouTube and TikTok (`PublishTarget` schema ready). Worker task `vrs.publish.push` that uploads a completed export to the target. UI on `/settings/publishing`.
3. **Support ticket reply thread** — UI for the admin console + user-facing `/support/tickets/[id]` page, backed by `SupportTicket` + `TicketMessage` schema.
4. **Video-ranking workflow** — the "top-10 compare" feature. Requires a batch-import UI, a compare view (two-column A/B) and an export path that generates a ranked video.
5. **Google OAuth sign-in** — `Account` model already supports it. Add `/v1/auth/google` + callback, wire in web sign-in page.
6. **Grafana dashboards** — commit JSON artifacts to `infrastructure/grafana/` matching the alerts described in `docs/OBSERVABILITY.md`.
7. **k6 load tests** — `infrastructure/loadtests/api.js` for the auth flow, project CRUD, and export path.
8. **Legal pages** — privacy, terms, DMCA takedown intake at `/legal/*`.
9. **Sentry + OTel full instrumentation** — trace propagation across HTTP + broker + worker boundaries.
10. **CDN + DNS Terraform modules** — CloudFront in front of the public bucket + static Next.js output; Route53 records + ACM validation.

**Notes for resuming:**

- The SDK is the single import surface for the web app; every new API endpoint should land there in the same session.
- `apps/web/src/state/timeline-sync.ts` owns editor persistence. Adding a new clip field means wiring it through `clipToPayload` + `clipsDiffer` there.
- `apps/workers/src/vrs_workers/compose.py` is the source of truth for the render graph. New render targets go in `PRESETS`.
- Terraform state is per-env in S3, locked by DynamoDB. Bootstrap those two resources once per AWS account before the first `terraform init`.
- Metrics endpoint is `/metrics`; scrape it from Prometheus but keep it off the public ALB.
- Voice-clone flow requires `ELEVENLABS_API_KEY`. All other providers are optional/switchable.
