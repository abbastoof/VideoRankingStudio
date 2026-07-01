# Grafana dashboards

Committed dashboard JSON artifacts. Each file is importable as-is via
Grafana's **Dashboards → New → Import** flow, or provisionable through
`grafana-provisioning/dashboards/`.

All dashboards assume:

- Prometheus data source named `Prometheus` scraping the API `/metrics`
  endpoint and the workers' Celery exporter.
- Postgres data source named `PostgresApp` pointed at the primary
  cluster (read replica preferred).

## Files

| File | Purpose |
| ---- | ------- |
| `api-health.json` | Request rate, error ratio, p50/p95/p99 per route |
| `worker-throughput.json` | Jobs by queue, retry ratio, p95 job latency |
| `export-pipeline.json` | Export queue depth, render time by preset, failure rate |
| `billing-funnel.json` | Signups → verified → subscribed → churn |
| `infrastructure.json` | CPU/RAM/DB connections per ECS service |

## Provisioning example

```yaml
# grafana-provisioning/dashboards/vrs.yaml
apiVersion: 1
providers:
  - name: vrs
    folder: VideoRankingStudio
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards/vrs
```
