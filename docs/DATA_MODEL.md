# Data model

The database schema lives in `packages/db/prisma/schema.prisma` — that file
is authoritative. This document exists to give a maintainer the reason each
model exists and the invariants that don't fit in Prisma comments.

## Provider

Postgres. Deployed via managed Postgres in production; docker-compose in
dev. Redis is used for cache and queue, not for anything that has to survive
a restart.

## Migrations

- `pnpm db:migrate` — apply pending migrations against the current
  `DATABASE_URL`.
- `pnpm db:migrate:deploy` — non-interactive; used in CI/deploy.
- `pnpm db:seed` — idempotent seed of plan catalog and reference data.
- `pnpm db:reset` — destructive; do not run against a shared environment.

## Conventions

- Primary keys are `String @id @default(cuid())`. IDs are opaque, sortable,
  and safe to expose in URLs.
- Every user-owned model carries a `userId` foreign key with
  `onDelete: Cascade`, so a hard user deletion cleans up transitively.
- Timestamps are `DateTime` with UTC storage. `createdAt` uses
  `@default(now())`; mutable models add `updatedAt @updatedAt`.
- Soft-delete pattern for entities that require a grace period (users,
  projects): a nullable `deletedAt` column. A background purge job (see
  `RUNBOOKS.md`) hard-deletes past the retention window.
- Indexes exist for every query used in a hot path. If you add a new query,
  add the index in the same migration.

## Core domain

### Users, sessions, auth

- `User` — the account holder. Fields include email, name, role, status
  (`ACTIVE | SUSPENDED | PENDING_DELETION`), locale, timezone, marketing
  opt-in, and `deletedAt` for soft delete.
- `Account` — federated identity link (Google today; more providers land
  as they ship).
- `Session` — one row per active refresh cookie. Fields: `refreshTokenHash`
  (hex hash, never plaintext), `userAgent`, `ip`, `expiresAt`, `revokedAt`,
  `replacedById` (points at the session that superseded it during rotation).
- `OtpCode` — short-lived email codes. `hash` is stored, not the code
  itself. Rows are hard-deleted after `expiresAt + retention`.
- `ApiKey` — reserved for the coming public developer API. Not yet in use.

### Projects, editor, timeline

- `Project` — a workspace containing a timeline plus derived exports. Owns
  aspect ratio, duration budget, template, and settings JSON.
- `Track` — a channel on the timeline (`VIDEO | AUDIO | CAPTION`). Indexed
  by `(projectId, kind, index)` for cheap ordering.
- `Clip` — one segment on one track. Fields cover source (`ASSET |
  VOICEOVER | AI_IMAGE | AI_VIDEO`), timing (`startMs`, `durationMs`,
  `inMs`, `outMs`), and per-clip effects (`speed`, `volume`, `opacity`,
  `isHighlight`).
- `Asset` — anything a user or worker uploaded to S3-compatible storage.
  Carries object key, sha256, size, dimensions, and provenance
  (`SOURCE | GENERATED | THUMBNAIL | EXPORT`).

### Transcripts, captions, voice

- `Transcript` and `TranscriptSegment` — per-source transcription with
  frame-accurate segment boundaries. Segments carry optional speaker labels
  and per-word timings for karaoke-style captions.
- `Caption` — the compiled caption track a user edits. Style JSON captures
  font, colour, background, and alignment. `segmentsJson` is a compact
  snapshot for renderers.
- `Voice` — the catalog entry for a voice, including clone status and
  consent metadata.
- `Voiceover` — a rendered voice line for a specific project and script.

### AI and jobs

- `AiJob` — one row per queued worker job. Fields: `kind` (highlights,
  transcription, voice, script, image, video, thumbnail, export, publish),
  `status`, `progress`, `provider`, `error`, plus timing (`startedAt`,
  `finishedAt`). Progress is authoritative for the client's job stream.
- `Export` — a rendered output file with format/resolution/fps.
- `PublishTarget` and `PublishJob` — creator-authored destinations and the
  jobs that publish to them.

### Templates, ranking, insights

- `Template` — reusable project blueprints (aspect ratio, tracks, style).
- Ranking and insights tables are still evolving; see the schema for
  current shape.

### Billing

- `Plan` — the catalog. Public plans are readable without auth (see
  `/v1/billing/plans`). Fields: `code`, `name`, `description`,
  `monthlyPriceCents`, `annualPriceCents`, `trialDays`, `features[]`,
  `highlight`, `stripe*Id` mappings.
- `Subscription` — the user's current billing state (`ACTIVE`, `TRIALING`,
  `PAST_DUE`, `CANCELED`) plus Stripe customer/subscription IDs and
  `cancelAtPeriodEnd`.
- `Invoice` — historical invoices mirrored from Stripe webhooks.
- `UsageRecord` — per-period counters for capped resources
  (project count, voiceover characters, exports).

### Support, moderation, admin

- `SupportTicket`, `TicketMessage` — creator ↔ support conversation with
  internal-note flag for staff-only messages.
- `AbuseReport` — moderation queue.
- `AuditLog` — append-only trail of privileged actions. Fields: `actorId`,
  `action`, `targetType`, `targetId`, `ip`, `meta` (opaque JSON). Indexed
  by `(action, createdAt)` and `(actorId, createdAt)`.
- `WebhookDelivery` — inbound webhook receipts (Stripe today) with idempotency
  guarantees.
- `Notification` — in-app notifications with `readAt`.
- `FeatureFlag` — server-side kill switches, default state + rollout %.

## Retention

- Sessions: hard-deleted 30 days past `expiresAt`.
- OTP codes: hard-deleted after expiry.
- Users soft-deleted (`status = PENDING_DELETION`): hard-purged 30 days later
  by the purge worker.
- Audit logs: retained indefinitely. This is a security boundary — do not
  add a TTL without security review.
- Uploaded assets: retained for the life of the parent project; orphan
  cleanup runs weekly.

## When you add a table

1. Add the model to `schema.prisma` with clear field-level comments.
2. Generate a migration: `pnpm --filter @vrs/db migrate`. Commit both the
   schema change and the migration.
3. Add every query-supporting index in the same migration.
4. Update this file if the new table is core-domain.
