# Terraform infrastructure

Reproducible AWS environments for VideoRankingStudio.

## Layout

```
infrastructure/terraform/
├── modules/
│   ├── network/          VPC, subnets, NAT, security groups
│   ├── database/         RDS Postgres (Aurora Serverless v2)
│   ├── cache/            ElastiCache Redis
│   ├── storage/          S3 buckets + lifecycle policies
│   ├── cdn/              CloudFront + ACM
│   ├── ecs-service/      Generic ECS Fargate service module
│   ├── secrets/          Secrets Manager entries
│   └── dns/              Route53 records
├── envs/
│   ├── dev/
│   ├── staging/
│   └── production/
└── shared/               Backend state config (S3 + DynamoDB lock)
```

## Layout philosophy

- One Terraform module per concern; environments compose them.
- State lives in per-env S3 buckets with DynamoDB locking.
- Provider version pinned; module versions internal (path-based).
- No secrets in `.tfvars` — everything sensitive is a Secrets Manager
  reference the ECS task role reads at boot.

## Bootstrapping a new environment

```bash
cd infrastructure/terraform/envs/dev
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

## Deployment pipeline

`.github/workflows/deploy.yml` runs `terraform apply` on merge to `main`
after image tags are pushed. See `docs/DEPLOYMENT.md`.
