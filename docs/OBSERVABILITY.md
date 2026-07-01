# Observability

## Signals

We collect four things and design dashboards around each:

1. **RED metrics** per HTTP route (rate, errors, duration).
2. **Queue depth + job durations** per worker queue.
3. **Business events** (signups, conversions, exports, cancels).
4. **Infrastructure telemetry** (CPU / RAM / DB / cache) — CloudWatch native.

## Where signals live

| Signal | Source | Sink |
| ------ | ------ | ---- |
| HTTP request logs | `apps/api` via pino | CloudWatch Logs |
| Worker task logs | `apps/workers` via structlog | CloudWatch Logs |
| HTTP RED + custom counters | Prometheus registry at `/metrics` | Prometheus scrape → Grafana |
| Traces | OpenTelemetry SDK | OTLP endpoint (collector or SaaS) |
| Exceptions | Sentry SDK in every app | Sentry projects: `vrs-api`, `vrs-web`, `vrs-workers` |
| Business events | Audit log + custom events | Postgres → BI pipeline |

## Dashboards

Grafana dashboards live in `infrastructure/grafana/`. Each JSON is a
committed artifact; import it into a fresh Grafana with the Prometheus
data source pointed at our scrape endpoint.

Primary dashboards:

- **API health** — request rate, p50/p95/p99, error ratio by route.
- **Worker throughput** — jobs completed per minute, failure rate, retry
  ratio, p95 latency per queue.
- **Export pipeline** — median render time by preset, queue depth,
  provider error rate.
- **Billing funnel** — signups → verified → subscribed → active → churn.
- **Infrastructure** — CPU / RAM / connections per ECS service.

## Alerts

Alerts route to PagerDuty. Escalation: on-call primary → on-call
secondary → engineering lead.

- API 5xx rate above 1% for 5 min → P2.
- API p95 latency > 800 ms for 10 min → P3.
- Worker queue lag > 500 jobs → P2.
- Stripe webhook backlog > 20 events → P2.
- Any Sentry alert with `level=error` and >10 events/min → P3.
- Database CPU > 85% sustained 15 min → P3.

## Log conventions

- Structured JSON in production; pretty in dev.
- Every log line carries `requestId` if inside a request scope, `jobId`
  if inside a worker scope, and `userId` if authenticated.
- Redaction list is configured in `apps/api/src/lib/logger.ts` and
  `apps/workers/src/vrs_workers/logging.py`. Extend it any time a new
  field could carry a secret.
