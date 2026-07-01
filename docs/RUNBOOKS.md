# Runbooks

Concise, actionable playbooks for the on-call engineer.

## Table of contents

1. [Queue backlog](#queue-backlog)
2. [Elevated 5xx error rate](#elevated-5xx-error-rate)
3. [Failed Stripe webhook backlog](#failed-stripe-webhook-backlog)
4. [Database CPU spike](#database-cpu-spike)
5. [Export pipeline stuck](#export-pipeline-stuck)
6. [AI provider outage](#ai-provider-outage)
7. [OTP delivery failures](#otp-delivery-failures)
8. [Suspected abuse or fraud](#suspected-abuse-or-fraud)

## Queue backlog

**Trigger:** Prometheus alert `worker_queue_lag > 500` for 10 minutes.

1. Look at Grafana → **Worker throughput** dashboard. Which queue is
   backed up?
2. Check for a specific provider outage in Sentry — a provider 5xx will
   push retries into the queue.
3. Scale the offending queue's ECS service:
   `aws ecs update-service --service vrs-workers-<queue> --desired-count N`.
4. If the backlog is legitimate (a big burst), let autoscaling catch up
   and monitor. Update the customer status page.
5. If a specific job kind is failing repeatedly, cancel via the API
   `POST /v1/jobs/:id/cancel` and file a bug.

## Elevated 5xx error rate

**Trigger:** `api_5xx_ratio > 1%` for 5 minutes.

1. Grafana → **API health**. Look at which route is dominating.
2. Sentry → filter last 15 minutes. Read the top exception.
3. If the error started at deploy time: consider rolling back to the
   previous ECS task definition. Rollback command:
   `aws ecs update-service --force-new-deployment --task-definition <prev-arn>`.
4. If the error is DB-related, jump to [Database CPU spike](#database-cpu-spike).
5. Post an incident to `#incidents` with:
   root cause, time detected, time mitigated, blast radius, follow-up
   actions.

## Failed Stripe webhook backlog

**Trigger:** `webhook_failed_total > 20` in 10 minutes.

1. `psql` → `SELECT * FROM "WebhookDelivery" WHERE source='STRIPE' AND status='FAILED' ORDER BY receivedAt DESC LIMIT 20`.
2. Read `errorMessage`. Common causes:
   - `STRIPE_WEBHOOK_SECRET` mismatch after a Stripe key rotation.
   - Schema drift — a new event type we don't handle. Log and mark
     `IGNORED`, then add the handler.
3. Requeue with `POST /v1/admin/webhooks/replay` (todo — currently
   psql-only) or drop the row after confirming customer state.

## Database CPU spike

**Trigger:** RDS CPU > 85% for 15 minutes.

1. Enable performance insights (already on). Grafana → **Infrastructure**
   → top queries.
2. Common culprits:
   - Missing index. Add one via a migration.
   - Runaway query from a new feature. Consider a killswitch via feature
     flag: `PATCH /v1/admin/flags/:id`.
3. If write-heavy: check if a batch job is running mid-day. Move to
   off-peak window.
4. Escalate to owning team if the query originates outside the app.

## Export pipeline stuck

**Trigger:** Exports queued > 20 for more than 15 minutes, or user report.

1. Check the `vrs-workers-export` service — is the desired count > 0?
2. `docker exec` into a running task and run
   `celery -A vrs_workers.celery_app:celery_app inspect active`.
3. Common causes:
   - FFmpeg segfault on a specific asset (see logs for the input path).
     Cancel the job, mark the export failed, and open a bug with a
     minimal-repro FFmpeg command.
   - S3 rate-limit — check CloudWatch for 503s on the exports bucket.
     Consider enabling S3 Transfer Acceleration.
4. If a single project is jamming the queue, cancel via admin console
   and refund the export minute quota.

## AI provider outage

**Trigger:** Repeated `AI_PROVIDER_DOWN` errors from a specific provider.

1. Confirm on the provider's status page.
2. Flip the relevant `*_PROVIDER` env var to the fallback provider
   (e.g. `TTS_PROVIDER=polly` if ElevenLabs is down) via ECS task
   definition update.
3. Post to the customer status page with the affected capability and
   expected resolution time.
4. When the provider recovers, revert the env var.

## OTP delivery failures

**Trigger:** `otp_delivery_failed_total > 10` in 5 minutes.

1. Check the email provider dashboard (SendGrid / SES). Bounce rate?
2. Check the audit log:
   `SELECT * FROM "AuditLog" WHERE action='auth.otp.requested' ORDER BY id DESC LIMIT 50`.
3. If SendGrid: reputation issue → warm up a fresh IP.
   If SES: sandbox mode or throttling.
4. Users can be issued a support-mediated token via admin console
   (a support-scoped flow, not yet wired — track this in `#roadmap`).

## Suspected abuse or fraud

**Trigger:** Multiple abuse reports on the same user; high card-decline
rate; unusual usage bursts.

1. Suspend the user immediately: `PATCH /v1/admin/users/:id`
   `{ "status": "SUSPENDED" }`. This also revokes their active
   sessions via the audit hook.
2. Freeze in-flight jobs: `POST /v1/jobs/:id/cancel` for anything in
   `QUEUED` or `RUNNING`.
3. Review S3 uploads for prohibited content. Delete via lifecycle
   override if warranted.
4. If payment fraud: cancel the subscription immediately and issue a
   refund via Stripe dashboard. File a chargeback dispute if it
   escalates.
5. Document the incident. Update abuse-report entries with
   `resolutionNote`.
