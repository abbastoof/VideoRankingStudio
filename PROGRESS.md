# Progress

This document tracks per-module completion across sessions. **First thing to read when picking up the project.**

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Timeline persistence + full AI generation endpoints + WS-driven editor + multi-track FFmpeg compose + export status page. Repo is runnable.

## Roadmap

### Phase 0 — Foundation
| Module | Status | Notes |
| --- | --- | --- |
| Monorepo skeleton | ✅ | pnpm workspaces + Turborepo |
| Top-level docs | ✅ | README, ARCHITECTURE, CONTRIBUTING, SECURITY |
| `.env.example` | ✅ | Every subsystem documented |
| Shared config / types / ui / db / sdk | ✅ | 5 packages |
| Database schema (Prisma) | ✅ | ~35 models, indexed |
| Seed (plans, voices, templates) | ✅ | |
| Docker Compose dev infra | ✅ | postgres / redis / minio / rabbitmq / mailhog |
| API skeleton | ✅ | Fastify, plugins, swagger, ws |
| Web app skeleton | ✅ | Next.js 14 App Router + design system |
| Workers (Celery + FastAPI) | ✅ | 9 tasks: transcribe, tts, highlights, script gen+rewrite, image, video, url import, export, thumbnail |
| CI workflow + Dockerfiles | ✅ | Lint/typecheck/test/build/Trivy + 3 prod Dockerfiles |
| Terraform skeleton | ⬜ | Phase 9 work |

### Phase 1 — Auth & users
| Module | Status | Notes |
| --- | --- | --- |
| OTP request + verify | ✅ | |
| JWT + opaque refresh rotation | ✅ | |
| Session middleware | ✅ | `requireAuth`, `requireAdmin`, `requireInternal` |
| Sign-in / verify pages | ✅ | |
| Dashboard | ✅ | |
| Profile form (UI) | ✅ | Now wired to `PATCH /v1/users/me` |
| `GET/PATCH /v1/users/me` | ✅ | |
| Session list + revoke endpoints | ✅ | `GET /v1/users/me/sessions`, `DELETE /v1/users/me/sessions/:id`, `POST .../revoke-all` |
| Delete account (soft, GDPR grace period) | ✅ | `DELETE /v1/users/me` |
| Audit log writes | ⬜ | |
| OAuth (Google) | ⬜ | |

### Phase 2 — Projects & assets
| Module | Status | Notes |
| --- | --- | --- |
| Project CRUD (`POST/GET/PATCH/DELETE /v1/projects`, `/duplicate`) | ✅ | with quota enforcement |
| Presigned upload | ✅ | direct-to-S3 PUT |
| URL import | ✅ | enqueues worker job |
| Asset CRUD (list/get) | ✅ | presigned URLs on read |
| Internal callback routes | ✅ | jobs, timeline, assets/transcripts/voiceovers/exports done |
| Projects list page | ✅ | search, badges, pagination |
| New-project wizard | ✅ | Upload / URL / Script flows |
| Templates page | ✅ | |

### Phase 3 — Editor (timeline)
| Module | Status | Notes |
| --- | --- | --- |
| Timeline state store (zustand) | ✅ | |
| Timeline lane component (drag/trim/split) | ✅ | |
| Preview pane (HTML5 video, playhead sync, caption overlay) | ✅ | |
| Sidebar tools | ✅ | Media / Highlights / Captions / Voice / Script & Image — **all wired to real API** |
| Toolbar (Save / Export / Undo / Redo / Zoom) | ✅ | |
| Keyboard shortcuts (Space / B / Delete / arrows / +/- / ⌘Z / ⌘⇧Z / ⌘Y) | ✅ | |
| Clip mutation REST endpoints | ✅ | `POST/PATCH/DELETE /projects/:id/{tracks,clips}`, `/clips/:id/split`, `/clips/:id/move`, `/clips/reorder` |
| Timeline REST hydration (`GET /projects/:id/timeline`) | ✅ | authed endpoint alongside the internal one |
| Undo/redo command history | ✅ | 200-entry ring buffer, JSON-serialisable commands |
| Autosave with optimistic updates | ✅ | Debounced diff-based sync; server-assigned ids swapped back into store |
| WebSocket job progress → editor | ✅ | `JobProgressStrip` renders every in-flight generation job |
| Editor server hydration (real tracks + clips) | ✅ | Falls back to blank tracks on error |
| Multi-track + split-screen layouts | 🟡 | schema + compose graph support it; UI for adding overlay tracks pending |

### Phase 4 — AI features
| Module | Status | Notes |
| --- | --- | --- |
| Highlights worker | ✅ | FFmpeg energy + scene cuts |
| Transcription worker | ✅ | OpenAI Whisper / faster-whisper / Deepgram |
| TTS worker | ✅ | ElevenLabs / Polly |
| Script generate + rewrite | ✅ | Anthropic + OpenAI |
| Image gen worker | ✅ | Stability + Replicate |
| URL import worker | ✅ | yt-dlp |
| Export render worker | ✅ | Multi-track compose graph (see Phase 5) |
| Thumbnail worker | ✅ | |
| Video generation worker | ✅ | Runway / Pika / Replicate SVD |
| `POST /v1/projects/:id/generate/{highlights,transcribe,voice,script,rewrite,image,video,thumbnail}` | ✅ | authed enqueue endpoints with quota checks |
| `POST /v1/projects/:id/export` | ✅ | |
| `GET /v1/jobs/:id`, `POST /v1/jobs/:id/cancel`, `POST /v1/jobs/:id/retry` | ✅ | |
| Voices list + clone endpoints | ✅ | `GET /v1/voices`, `POST /v1/voices/clone`, `DELETE /v1/voices/:id` |
| Voice clone worker | ⬜ | Endpoint enqueues; worker implementation lands next |

### Phase 5 — Export & publish
| Module | Status | Notes |
| --- | --- | --- |
| `POST /v1/projects/:id/export` route | ✅ | Enforces monthly export minutes; applies free-plan watermark automatically |
| Export listing + detail (`GET /v1/projects/:id/exports`, `GET /v1/exports/:id`) | ✅ | |
| Export status WS push | ✅ | Same `/v1/ws/projects/:id` channel, filtered by job id |
| Export status page (`/projects/[id]/exports/[exportId]`) | ✅ | Live progress, download, retry, expiry |
| **Multi-track FFmpeg compose graph** | ✅ | `apps/workers/src/vrs_workers/compose.py` — trims, scales, overlays with z-order, audio mix with atempo chain for extreme speeds, sidechain-ducked background music, caption burn-in via libass, watermark PNG or drawtext fallback, EBU R128 normalization |
| Render presets | ✅ | `PRESETS` dict in `compose.py` (shorts_1080/720, square, landscape 1080p/4K) |
| Caption burn-in + animation | 🟡 | Static burn-in works; word-by-word animation waits on caption editor rework |
| Watermark for free plan | ✅ | PNG overlay when `/opt/vrs/watermark.png` is present, drawtext fallback otherwise |
| Direct publish (YouTube / TikTok / Instagram) | ⬜ | |

### Phase 6 — Billing & quotas
*(unchanged — all ✅ from Session 2)*

### Phase 7 — Analytics & insights
*(unchanged — all ⬜)*

### Phase 8 — Admin & operations
*(unchanged — all ⬜)*

### Phase 9 — Production readiness
| Module | Status | Notes |
| --- | --- | --- |
| Terraform (VPC / ECS / RDS / ElastiCache / S3 / CF / ACM / R53) | ⬜ | |
| Helm/K8s manifests | ⬜ | |
| Sentry, OTel, Prometheus dashboards | 🟡 | DSNs wired |
| Runbooks | ⬜ | |
| Load tests + chaos drills | ⬜ | |
| Compliance docs | ⬜ | |

## Per-session log

### Session 3 — Timeline persistence, AI endpoint surface, full compose graph
**Landed:**
- **Timeline persistence** — repo + service + routes for tracks and clips:
  - `POST/PATCH/DELETE /v1/projects/:id/tracks(/:trackId)`
  - `POST/PATCH/DELETE /v1/projects/:id/clips(/:clipId)`
  - `POST /v1/projects/:id/clips/:clipId/split` (atomic left/right)
  - `POST /v1/projects/:id/clips/:clipId/move`
  - `POST /v1/projects/:id/clips/reorder` (batched)
  - `GET /v1/projects/:id/timeline` (authed hydration endpoint)
  - Every mutation recomputes the project's cached `durationMs`.
- **Undo/redo** — JSON-serialisable command history (200-entry ring), `⌘Z / ⌘⇧Z / ⌘Y` bindings, invertible commands for move/trim/split/create/delete on both clips and tracks.
- **Autosave** — debounced diff-based sync (`timeline-sync.ts`): computes a per-flush delta against the last snapshot, PATCHes tracks/clips, batches cross-track moves through `/clips/reorder`. Optimistic ids swapped back on server response. Snapshot re-anchored on save; retries queued if flush overlaps with new edits.
- **Full AI endpoint surface**:
  - `POST /v1/projects/:id/generate/{highlights,transcribe,voice,script,rewrite,image,video,thumbnail}` — all quota-aware, idempotency-key-scoped, create the right domain rows (Transcript / Voiceover) before enqueueing, and return `{ jobId }` plus the domain id where relevant.
  - `POST /v1/projects/:id/export` — enforces `EXPORT_MINUTES` quota, applies free-plan watermark automatically, creates `Export` row + enqueues `vrs.export.render`.
  - `GET /v1/projects/:id/exports`, `GET /v1/exports/:id` — listing + status with presigned 7-day download URL when complete.
  - `GET /v1/jobs/:id`, `POST /v1/jobs/:id/cancel`, `POST /v1/jobs/:id/retry`.
  - `GET /v1/voices`, `POST /v1/voices/clone`, `DELETE /v1/voices/:id`.
  - `GET/PATCH /v1/users/me`, session list + revoke + delete account.
- **Editor wiring**:
  - Sidebar tools invoke the real API for highlights, captions, voiceover (with stock voice picker), script generation (tone × format), image generation. Every enqueue puts a row into the store's `activeJobs` map.
  - `JobProgressStrip` component renders every in-flight job with progress bar, status icon, and terminal errors.
  - `connectJobStream(projectId)` — WS client with exponential backoff, feeds `activeJobs`.
  - Editor server hydration now reads the timeline via SDK; blank-tracks fallback if the request fails.
- **Export pipeline**:
  - `compose.py` — production-quality multi-track FFmpeg graph builder: input dedup, per-clip trim/scale/crop/opacity, z-ordered overlays with time-gated enable, audio mix with `atempo` chain that handles speeds outside `[0.5, 2.0]`, sidechain-ducked background music, caption burn-in via libass with style translated from JSON, watermark PNG overlay (drawtext fallback), EBU R128 normalization on the final mix.
  - `export_render.py` — rewritten around the new compose graph, downloads assets + voiceovers + caption SRT once each, posts done-callback to internal endpoint.
  - Export status page at `/projects/[id]/exports/[exportId]` — live progress via WS, polling fallback, download button when ready, retry action.
  - `PRESETS` dict for named render targets (shorts, square, landscape 1080p/4K).
- **Video generation worker** — Runway / Pika / Replicate SVD adapters.
- **SDK** — every new endpoint added, typed responses.

**Compiles + runs?** All TypeScript checks against the current tsconfig — the API adds `usersRoutes`, `timelineRoutes`, `generationRoutes`, `voicesRoutes` to the plugin registration. The web app boots against an empty DB (falls back to blank tracks).

**Next session's implementation queue, in order:**

1. **Audit log writes** — auth events (OTP request, verify, refresh, signout), billing events (subscribe / cancel / webhook processed), and admin actions. `AuditLog` table already exists.
2. **Admin console** at `/admin` — user list + detail (role, status, plan, revoke sessions, impersonate), subscription list, abuse queue, support tickets, feature flag toggles.
3. **Analytics & insights** page — usage over time, most-generated kinds, top templates; opt-in YouTube import for external stats.
4. **Voice-clone worker** — receives sample asset ids, transcodes to mono 16k, calls ElevenLabs voice create endpoint, updates the Voice row with `providerVoiceId` and `status=READY`.
5. **Caption editor UI** — timeline caption track becomes editable, segments come from transcript, style panel (font, colour, position, animation).
6. **Publish targets** — OAuth flows for YouTube + TikTok, `PublishTarget` + `PublishJob` UI, background worker to push exports to platforms.
7. **Google OAuth sign-in**.
8. **Terraform** — VPC / ECS / RDS / ElastiCache / S3 / CloudFront / ACM / Route53.

**Notes for resuming:**
- Every new API endpoint is exposed via `@vrs/sdk` — keep it as the single import surface for the web app.
- `apps/web/src/state/timeline-sync.ts` owns the persistence contract. If new clip fields appear, wire them through `clipToPayload` + `clipsDiffer`.
- `apps/workers/src/vrs_workers/compose.py` is the source of truth for the render graph. `PRESETS` is the safe place to add new render targets without touching the task itself.
- WS channel is `/v1/ws/projects/:id`; every worker publishes `vrs:job:{jobId}` on Redis pubsub — no additional wiring required for future task types.
