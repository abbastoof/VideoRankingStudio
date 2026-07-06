# Enterprise Gap Analysis — July 2026

Benchmark set: Viblo.ai (primary), Opus Clip, Klap, Vizard, Submagic, plus
enterprise-tier patterns from Descript/HeyGen/Canva. Grounded in live pricing/
feature research (July 2026), published user complaints, and two full audits
of this codebase. Updated after the ranking builder + export pipeline were
verified end-to-end on a live stack.

## Executive summary

1. **The core loop is real and verified.** Signup → build ranking → live
   preview → FFmpeg export renders correctly (fonts, overlays, trim
   frame-accurate). That is further than most competitors' "demo-grade"
   claims — and it is the foundation everything below builds on.
2. **The creator surface is ~85% of Viblo's ranking product** — remaining
   visible gaps: Voiceover / Size & Position / Animation & Transition /
   Sound Effect tabs, and template-driven starts.
3. **The market monetizes programmatic access** (Vizard API on paid plans,
   Submagic $0.10–0.15/min metered API, Klap per-operation billing, Opus
   Business API+SSO). We have a dormant `ApiKey` model and zero public-API
   surface — the highest-leverage enterprise gap.
4. **Users leave competitors over billing friction** (hidden refunds,
   projects deleted 3 days after cancel, no renewal warning, credit
   opacity). Our transparent quota model + one-click cancel is a
   differentiator to double down on, not an afterthought.
5. **Ops posture is unusually strong for this stage** (Terraform, ECS
   deploy, Grafana, Sentry/OTel, CI) but reliability details — outbound
   webhooks, job dead-lettering, asset GC, backup story — are unproven.

## Where we already meet or beat the market (verified, do not re-do)

- Viblo-style single-page ranking builder with live phone preview that
  matches the export rasterizer 1:1 (Viblo's own preview is approximate).
- Frame-accurate trim; per-candidate number/title styling; custom playback
  order; link import with auto-title; drag-drop upload with presigned flow.
- Text rendering in exports (Pillow rasterizer: fonts/stroke/pill/italic).
- OTP auth with refresh rotation; Stripe billing + atomic quotas; admin
  console (users/metrics/abuse/tickets/flags/audit); in-app notifications;
  YouTube/TikTok publish targets; insights + external stats ingestion;
  i18n scaffold; moderation on LLM inputs.

## Gap tiers

### P0 — users hit these in week one

| Gap | Why it matters | Current state | Size |
|---|---|---|---|
| Voiceover tab (per-candidate TTS) | Core Viblo tab; faceless-video table stakes across every competitor | Voices seeded + `/v1/voices` + TTS worker exist; no SDK method, no builder UI, no bake placement of VO audio | M |
| Animation & Transition tab | Hard cuts read as unfinished; every competitor ships fades/karaoke motion | `textJson.animation` stored but unrendered; compose has no transitions | M |
| Sound Effect / music bed | Viblo tab; silence between narration feels broken | Compose has full bg-music + sidechain ducking graph, permanently disabled; zero bundled audio assets | M |
| Size & Position + drag-on-preview | Viblo tab; only control users miss after height % | `transformJson` persisted but only `scale` honored; no x/y in compose overlay; no drag UI | L |
| Template-driven starts | Every competitor onboards via templates; blank-canvas kills activation | `Template` model + gallery exist; blueprint → ranking application path untested/unwired for RANKING type | M |
| Export niceties: SRT sidecar + GIF preview + 4K | Opus gates 4K behind Business — cheap differentiation; SRT expected by editors | Export model supports formats; worker renders MP4 only | S–M |

### P1 — competitive necessity (weeks 2–4)

| Gap | Why it matters | Current state | Size |
|---|---|---|---|
| Public API + API keys | Vizard/Submagic/Klap all monetize APIs; agencies script pipelines | `ApiKey` model dormant; no key auth path, no key mgmt UI | M |
| Outbound webhooks (render.completed etc.) | Table stakes beside an API; SIEM/Zapier entry point | `WebhookDelivery` model exists (inbound Stripe only) | M |
| Scheduled publishing + content calendar | Opus Pro headline feature; agencies live in the queue | Publish now-only; no schedule field, no calendar UI | L |
| Caption styles (karaoke word-by-word) | Submagic's entire wedge; ours renders static lines | Caption model + styleJson exist; compose burns plain SRT via libass | L |
| Bulk operations (multi-select, batch export) | Agency workflows; Opus/Vizard ship it | Single-item everywhere | M |
| Render queue UX (position, ETA, priority) | #1 complaint class at competitors is opaque queues | Job progress streams exist; no queue position/ETA surfaced | S |
| Onboarding: sample project + checklist | Activation basics; competitors' first-run is guided | Empty dashboard on first login | S |
| Trash / restore (soft-delete UX) | Competitors delete projects 3 days post-cancel — we can win trust | `deletedAt` soft-delete exists in schema; no restore UI/endpoint | S |

### P2 — enterprise sales enablers

| Gap | Why it matters | Current state | Size |
|---|---|---|---|
| Team workspaces + seats | Opus gates teams at Pro; Business = unlimited seats | No Team/Membership model; single-user ownership everywhere | XL |
| RBAC beyond USER/ADMIN | Enterprise checklist item #1 (before SSO) | Two roles only | M (after teams) |
| Audit log UI + export | Procurement checklist; model + admin route exist | `AuditLog` written on ~10 events; admin route exists; no UI, no export, sparse coverage | S–M |
| SSO (OIDC first, SAML later) | Gate for mid-market+; buy-vs-build favors managed IdP later | Google OAuth exists; no org-level SSO | L |
| GDPR: data export + account deletion | EU users + procurement | Deletion path partial; no export | M |
| SOC2-track hygiene (access reviews, retention docs) | Sales cycles stall without narrative | Docs absent | M (docs) |

### P3 — differentiators

- **Transparent billing** as a feature: usage meter always visible, renewal
  email, one-click cancel that keeps exports downloadable 30 days (directly
  targets the market's loudest complaint).
- **Preview = export guarantee** (already true) — market it; add a pixel-diff
  CI test that renders a golden ranking and compares against the preview.
- **Local/offline-friendly TTS fallback tier** (free "basic voice") — nobody
  offers a $0 voice path; converts free users.
- **AI ranking assistant**: paste a topic → LLM proposes candidates + search
  queries → one-click import top clips (uses existing script-gen worker).
- **Virality/pacing hints** on the builder (slot too long, title too wordy)
  — Opus's "virality score" but explainable.

## Recommended next 15 commits

1. Animation & Transition tab + compose fades (P0, fully local-verifiable).
2. Voiceover tab: SDK `listVoices`, builder UI, bake VO onto AUDIO track.
3. Music bed + SFX: enable the dormant ducking graph; bundle 6–8 OFL tracks;
   General Settings music picker.
4. SRT sidecar + GIF preview export options.
5. Size & Position tab (x/y/scale in compose + drag-on-preview).
6. Template gallery → ranking blueprints ("Top 5 products", "Countdown").
7. Sample project seeding on first login + 3-step checklist.
8. Render queue position/ETA in export status page.
9. Trash & restore for projects.
10. Public API v1: API-key auth middleware + key management UI + docs page.
11. Outbound webhooks with HMAC signatures + delivery log UI.
12. Bulk select on /projects + /rankings (delete, export).
13. Caption karaoke styles (word-timing burn-in path exists via transcripts).
14. Scheduled publishing (publishAt + Celery beat sweep + calendar strip).
15. Audit log viewer + CSV export in admin.

## Fastest wins available today

1. **Animation & Transition** — compose-side fades exist as a known pattern;
   text animations already persisted in every baked clip.
2. **Render queue position** — jobs table already tracks QUEUED order.
3. **Trash/restore** — `deletedAt` already set; add restore endpoint + UI.
