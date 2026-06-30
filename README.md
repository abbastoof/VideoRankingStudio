# VideoRankingStudio

> AI-powered short-form video creation platform. Upload a long video or paste a script, and the platform produces a finished, captioned, voiced, vertical-format video ready to publish.

[![CI](https://img.shields.io/badge/CI-pending-yellow)]()
[![License](https://img.shields.io/badge/license-proprietary-blue)]()
[![Node](https://img.shields.io/badge/node-20.11+-green)]()
[![Python](https://img.shields.io/badge/python-3.11+-green)]()

## Overview

VideoRankingStudio is a production-grade SaaS for automated short-form video production. It combines:

- A **timeline-based editor** with drag/drop clips, trimming, splitting, and multi-track layouts.
- **AI auto-clipping** that detects highlight segments from long footage.
- **AI voiceover** with stock voices and optional voice cloning.
- **Automatic transcription and captions** with frame-accurate sync.
- **AI script generation** and rewrite for ideation.
- **AI image / video generation** for thumbnails and b-roll.
- **Video import** from URLs (YouTube, TikTok, Instagram).
- **Subscription billing** with usage-based quotas.
- **Admin tools** for user, subscription, and support management.

## Architecture at a glance

```
┌────────────────┐         ┌─────────────────┐         ┌────────────────────┐
│   Next.js web  │ ◄─────► │  Fastify API    │ ◄─────► │  Postgres / Redis  │
│  (apps/web)    │   REST  │  (apps/api)     │         └────────────────────┘
└────────┬───────┘   /WS   └────────┬────────┘                  ▲
         │                          │ enqueue                   │
         │                          ▼                           │
         │                  ┌───────────────┐         ┌─────────┴────────┐
         │                  │  RabbitMQ /   │         │  AI workers       │
         │                  │  Redis queue  │ ──────► │ (apps/workers,    │
         │                  └───────────────┘         │  Python+Celery+   │
         │                                            │  FFmpeg+Whisper)  │
         │                                            └─────────┬────────┘
         │                                                      │
         ▼                                                      ▼
┌────────────────┐                                      ┌────────────────────┐
│  CloudFront    │ ◄────────────────────────────────────┤  S3 / MinIO        │
│  (assets)      │                                      │  (videos, audio,   │
└────────────────┘                                      │   images, exports) │
                                                        └────────────────────┘
```

Full architectural detail: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Repository layout

```
.
├── apps/
│   ├── web/         Next.js 14 frontend (App Router, Tailwind, design system)
│   ├── api/         Fastify backend (REST + WebSocket, auth, billing, orchestration)
│   └── workers/     Python FastAPI + Celery (AI tasks, video processing)
├── packages/
│   ├── db/          Prisma schema + client (single source of truth for data)
│   ├── types/       Shared TypeScript DTOs, API contracts, enums
│   ├── ui/          Reusable React components + design tokens
│   ├── sdk/         Generated typed API client (used by web + future mobile)
│   └── config/      Shared eslint/tsconfig/tailwind presets
├── infrastructure/
│   ├── terraform/   AWS infrastructure-as-code (VPC, ECS, RDS, S3, …)
│   ├── docker/      Production Dockerfiles for each app
│   └── k8s/         (optional) Kubernetes manifests
├── docs/            Engineering, API, security, operations docs
├── .github/         CI/CD workflows, issue/PR templates
├── docker-compose.yml      Local infrastructure (postgres, redis, minio, …)
├── turbo.json              Build pipeline (Turborepo)
├── pnpm-workspace.yaml     Workspace definition
├── tsconfig.base.json      Shared TypeScript config
├── PROGRESS.md             Roadmap & per-module completion status
└── README.md
```

## Quick start

### Prerequisites

- **Node.js** ≥ 20.11 (`.nvmrc`)
- **pnpm** ≥ 9
- **Python** ≥ 3.11 (workers only)
- **Docker** + **Docker Compose** v2
- **FFmpeg** ≥ 6 (for local worker development)

### First-time setup

```bash
git clone <repo-url> videorankingstudio
cd videorankingstudio
cp .env.example .env
make setup
```

`make setup` installs dependencies, starts local infrastructure, runs database migrations, and seeds reference data.

### Running locally

```bash
make dev        # runs web (3000), api (4000), workers (5000) in parallel
```

Then open:

- Web app: http://localhost:3000
- API docs: http://localhost:4000/docs
- Worker admin: http://localhost:5000/docs
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)
- Mailhog: http://localhost:8025
- RabbitMQ: http://localhost:15672 (vrs / vrs)
- Prisma Studio: `make db-studio`

### Useful commands

```bash
make help                 # list all targets
make test                 # unit + integration tests
make test-e2e             # Playwright E2E
make lint && make typecheck
make db-migrate           # create a new migration
make db-seed              # reseed dev data
make infra-reset          # wipe and restart docker-compose volumes
```

## Configuration

Every runtime variable is documented in [`.env.example`](.env.example). Keys are grouped by subsystem — runtime, database, queue, storage, auth, email, billing, AI providers, social import, observability, feature flags, quotas.

The platform is provider-agnostic where possible. For example, the `TTS_PROVIDER` env var swaps between ElevenLabs, Azure, AWS Polly, and Coqui without code changes.

## Documentation

| Doc                                                  | Contents                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                 | System architecture, data flow, scaling strategy               |
| [`PROGRESS.md`](PROGRESS.md)                         | Per-module completion roadmap                                  |
| [`docs/API.md`](docs/API.md)                         | REST API contract                                              |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)           | Database schema reference                                      |
| [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md)         | AI worker pipeline (highlights, voice, captions, image, video) |
| [`docs/BILLING.md`](docs/BILLING.md)                 | Stripe integration, plans, quotas, webhooks                    |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)           | Production deployment via Terraform + GitHub Actions           |
| [`docs/SECURITY.md`](docs/SECURITY.md)               | Threat model, secrets handling, GDPR, DMCA                     |
| [`docs/TESTING.md`](docs/TESTING.md)                 | Test strategy, coverage targets, E2E playbook                  |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md)     | Logging, metrics, tracing, alerting                            |
| [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md)               | On-call playbooks for common incidents                         |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                 | Coding standards, commit format, PR workflow                   |

## License

Proprietary. © VideoRankingStudio. All rights reserved. See `LICENSE`.
