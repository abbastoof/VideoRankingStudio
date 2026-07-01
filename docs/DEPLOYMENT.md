# Deployment

VideoRankingStudio ships as three container images (api, web, workers) plus
managed infrastructure provisioned by Terraform.

## Environments

| Env | Purpose | Scale | Deletion protection |
| --- | ------- | ----- | ------------------- |
| dev | integration testing, PR previews | scale-to-zero, single AZ | off |
| staging | pre-production parity | 2 tasks/service, single AZ | on |
| production | serves paying customers | multi-AZ, autoscaled | on |

## Prerequisites

- AWS account per environment.
- S3 state bucket + DynamoDB lock table (bootstrap once per account).
- Route53 hosted zone.
- ACM certificate for the environment's domain.

## Bootstrapping a new environment

```bash
cd infrastructure/terraform/envs/dev
terraform init -backend-config=backend.hcl
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Then run migrations against the new database:

```bash
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id vrs-dev/db-master \
  --query SecretString --output text | jq -r .database_url) \
  pnpm db:migrate:deploy
pnpm db:seed
```

## Deploying application code

`.github/workflows/ci.yml` builds and pushes container images to GHCR on
merge to `main`. A follow-up workflow (`.github/workflows/deploy.yml`)
updates the ECS task definitions in each environment.

Rollback is `aws ecs update-service --force-new-deployment` against the
previous task definition revision — task definitions are immutable and
version-numbered.

## Zero-downtime migrations

1. Ship the *additive* migration (new columns, new tables) — old code
   still works.
2. Deploy the new application code.
3. Once fully rolled out, ship the *cleanup* migration (drop old columns).

Never destructive-migrate in a single step against a running fleet.

## Secrets

All secrets live in AWS Secrets Manager. The ECS task role can read the
specific secrets referenced in the task definition's `secrets` block.
Rotation is either automatic (Stripe webhook signing key rotates on
demand from the Stripe dashboard) or handled by a scheduled Lambda
(JWT signing keys rotate quarterly, session tokens survive rotation
because access tokens are ≤ 15 minutes).

## Observability

- Logs: CloudWatch Logs, structured JSON, retention configured per env.
- Metrics: Prometheus scrape of `/metrics` on each ECS task via the
  ECS Container Insights integration.
- Traces: OpenTelemetry SDK ships spans to the OTEL_EXPORTER_OTLP_ENDPOINT
  (typically an OTel collector or a hosted APM).
- Errors: Sentry per app (`SENTRY_DSN` env var).

See `docs/OBSERVABILITY.md` for the dashboards and alert rules.
