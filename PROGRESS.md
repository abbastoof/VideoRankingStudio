# Progress

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** All planned roadmap phases complete. Multi-track editor, ranking workflow, external analytics, CDN+DNS Terraform, Grafana dashboards, Sentry+OTel, moderation, authenticated E2E, deploy workflow, and i18n scaffolding all landed.

## Roadmap

### Phase 0 — Foundation ✅
### Phase 1 — Auth & users ✅
### Phase 2 — Projects & assets ✅
### Phase 3 — Editor ✅
- Multi-track / split-screen UI adder now shipped: track picker menu +
  hover-revealed mute/lock/remove buttons on every track header.
### Phase 4 — AI ✅
- Prompt moderation (defence-in-depth) now wraps every LLM-facing endpoint.
### Phase 5 — Export & publish ✅
### Phase 6 — Billing & quotas ✅
### Phase 7 — Analytics & insights ✅
- Ranking projects (RANKING type) with candidate CRUD, reorder, style meta,
  and a `bakeTimeline` that regenerates video + overlay clips from the
  sorted list before export.
- YouTube stats import: refreshes access tokens on 401, stores viewCount /
  likeCount / commentCount on PublishJob.metadataJson, exposes an aggregated
  panel on the Insights page.
### Phase 8 — Admin & operations ✅
### Phase 9 — Production readiness ✅
- CloudFront + Route53 Terraform modules, wired into production env.
- Five Grafana dashboards committed: api-health, worker-throughput,
  export-pipeline, billing-funnel, infrastructure.
- Sentry + OpenTelemetry initialisation across API, workers, and web
  (all lazy-loaded, opt-in via env).
- `.github/workflows/deploy.yml` — Terraform apply, ECS task-def
  refresh per service, migrations, and post-deploy smoke check.
- Authenticated Playwright E2E via a test-only OTP-planting endpoint
  (registered only when NODE_ENV=test).
- i18n scaffolding: locale picker, English message bundle, `t()`
  helper with `{var}` interpolation and locale fallback.

## Per-session log

### Session 7 — Multi-track, rankings, external stats, CDN, dashboards, tracing, moderation, deploy, i18n

**Landed:**

- **Editor multi-track**: track kind picker + mute/lock/remove controls;
  `removeTrack` action with history entry.
- **Ranking workflow**: full RANKING project type — candidate CRUD, reorder,
  style panel, and `bakeTimeline` that rewrites overlay + video clips from
  the sorted candidates. New pages `/rankings/new` and `/rankings/[id]`,
  navigation entry added.
- **External analytics**: YouTube stats service refreshes OAuth tokens on
  demand, batches Videos.list up to 50 IDs, persists view/like/comment
  counts into PublishJob.metadataJson. `ExternalStatsPanel` on the
  Insights page renders totals + per-video table.
- **CloudFront + Route53 Terraform** modules with dual-origin CDN, path
  rules, ACM DNS validation, alias A/AAAA records; wired into
  `envs/production/cdn_dns.tf`.
- **Grafana dashboards**: five committed JSON artifacts + README.
- **Sentry + OTel**: `apps/api/src/lib/tracing.ts`, matching Python module,
  client-side `SentryClientInit`. All lazy-loaded and opt-in.
- **Content moderation**: local hard-block + signal-terms classifier,
  optional OpenAI Moderation API forwarding; `assertPromptAllowed` gates
  script, rewrite, image, and video generation.
- **Authenticated E2E**: `/v1/_test/plant-otp` (registered only when
  `NODE_ENV=test`), session helper for Playwright, `authed-projects.spec.ts`
  that skips if the API isn't reachable.
- **Deploy workflow** at `.github/workflows/deploy.yml`: environment
  resolver, Terraform apply, ECS task-def refresh per service, Prisma
  migration deploy, and post-deploy smoke check.
- **i18n scaffolding**: `apps/web/src/i18n/{config,t,messages/en}.ts` —
  Accept-Language picker, dotted-path lookup with `{var}` interpolation
  and locale fallback.

**Repository status:** Every roadmap item marked ✅ or superseded. The repo
is runnable end-to-end via `make setup && pnpm dev`, deployable via
Terraform + the new deploy workflow, and instrumented for observability
from day one.

**Future refinement candidates** (not blocking any current feature):
1. Populate additional i18n bundles (es/fr/de/pt/ja) as translations arrive.
2. Add a caption reveal animator (word-by-word) to the FFmpeg compose graph.
3. Wire Grafana provisioning ConfigMap for K8s deployment.
4. Extend the moderation classifier to run on transcript output as well
   as prompts.
5. Add a public status page consuming `/health/ready` from each service.
