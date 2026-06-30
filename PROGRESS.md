# Progress

This document tracks per-module completion across sessions. It's the **first thing** to read when picking up the project in a new session.

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current state:** Foundation + auth-service core done. Ready to layer feature work.

## Roadmap

### Phase 0 — Foundation
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Monorepo skeleton (pnpm + turbo + tsconfig + prettier + editorconfig) | ✅    |                                                             |
| Top-level documentation (README, ARCHITECTURE, PROGRESS, …)         | ✅    |                                                             |
| `.env.example` documenting every variable                           | ✅    |                                                             |
| `.gitignore`, `.editorconfig`, `Makefile`                           | ✅    |                                                             |
| Shared config package (`packages/config`)                           | ✅    | ESLint + TS + Tailwind presets                              |
| Shared types package (`packages/types`)                             | ✅    | Zod schemas across every domain                             |
| Database schema (`packages/db/prisma/schema.prisma`)                | ✅    | ~35 models, complete enums, indexed                         |
| Seed data (`packages/db/prisma/seed.ts`)                            | ✅    | Plans, stock voices, templates, dev admin                   |
| Prisma client + transactional helpers                               | ✅    |                                                             |
| `docker-compose.yml` for local dev                                  | ✅    | postgres / redis / minio / rabbitmq / mailhog               |
| Shared UI package (`packages/ui`)                                   | ✅    | Tokens (amber brand), Button, Input, Card, Spinner, Badge, Toast |
| API service skeleton (`apps/api`)                                   | ✅    | Server boots, health + auth routes wired                    |
| API config (env, db, redis, storage, email)                         | ✅    | Validated env, S3 client, nodemailer transports             |
| API lib (logger, errors, jwt)                                       | ✅    | Pino + redaction, AppError hierarchy, JWT + opaque refresh  |
| Auth service + OTP service                                          | ✅    | Argon2id-hashed codes, rotation, revocation                 |
| Web app skeleton (`apps/web`)                                       | ⬜    | Next.js 14 + Tailwind                                       |
| Workers skeleton (`apps/workers`)                                   | ⬜    | FastAPI + Celery + one example task                         |
| CI workflow (`.github/workflows/ci.yml`)                            | ⬜    |                                                             |
| Production Dockerfiles                                              | ⬜    |                                                             |
| Terraform skeleton (`infrastructure/terraform`)                     | ⬜    |                                                             |

### Phase 1 — Auth & users
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| OTP request + verify endpoints                                      | ✅    | `/v1/auth/otp/request`, `/v1/auth/otp/verify`               |
| JWT access/refresh tokens, rotation, revocation                     | ✅    | Refresh tokens are opaque + server-stored + rotated         |
| Session middleware (Fastify)                                        | ✅    | `requireAuth`, `requireAdmin`, `requireInternal`            |
| Email delivery (SMTP/SendGrid/SES)                                  | ✅    | Provider switchable by env                                  |
| Rate limiting on auth endpoints                                     | ✅    | Per-route override on /auth/*                               |
| Sign-in / sign-up pages (web)                                       | ⬜    |                                                             |
| Profile + settings UI                                               | ⬜    |                                                             |
| Audit log writes for auth events                                    | ⬜    |                                                             |
| OAuth (Google)                                                      | ⬜    | Account table already supports it                           |

### Phase 2 — Projects & assets
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Project CRUD endpoints                                              | ⬜    |                                                             |
| Presigned-upload flow + asset registration                          | ⬜    |                                                             |
| URL import endpoint (yt-dlp wrapper, worker side)                   | ⬜    |                                                             |
| Dashboard page (list, search, filter)                               | ⬜    |                                                             |
| New-project wizard                                                  | ⬜    |                                                             |
| Templates catalog + page                                            | ⬜    |                                                             |

### Phase 3 — Editor (timeline)
*(unchanged from previous version)*

### Phase 4 — AI features
*(unchanged)*

### Phase 5 — Export & publish
*(unchanged)*

### Phase 6 — Billing & quotas
*(unchanged)*

### Phase 7 — Analytics & insights
*(unchanged)*

### Phase 8 — Admin & operations
*(unchanged)*

### Phase 9 — Production readiness
*(unchanged)*

## Per-session log

### Session 1 — Foundation + auth core
**Landed:**
- Monorepo skeleton (pnpm workspaces + Turborepo).
- Complete Prisma schema (~35 models) + seed (4 plans, 5 stock voices, 5 templates, dev admin).
- Docker Compose dev infra (postgres/redis/minio/rabbitmq/mailhog).
- Shared packages: `@vrs/db`, `@vrs/types`, `@vrs/config`, `@vrs/ui`.
- UI foundation: design tokens (light + dark), `Button`, `Input`, `Card`, `Spinner`, `Badge`, `Toast`.
- API service: server boot, plugins (helmet/cors/cookie/rate-limit/swagger/websocket), error envelope, structured logging, OTP service (Argon2id), auth service (JWT + opaque refresh + rotation), `/v1/auth/otp/request`, `/v1/auth/otp/verify`, `/v1/auth/refresh`, `/v1/auth/signout`, `/v1/auth/session`, `/health`, `/health/ready`.
- Email service with templated OTP + export-ready messages, provider-switchable via env.
- Top-level docs: README, ARCHITECTURE, CONTRIBUTING, SECURITY.

**Next session should start with:**
1. Web app scaffold: Next.js 14 App Router with the design system wired, route groups for marketing / auth / app / admin, and the sign-in + verify pages connected to `/v1/auth/otp/*`.
2. Workers service: Celery app + FastAPI admin + first real task (transcription via Whisper).
3. CI pipeline + production Dockerfiles.
4. Then start Phase 2: project CRUD + presigned uploads + dashboard.

**Notes for resuming:**
- All env vars are documented in `.env.example`. Run `make setup` for first-time provisioning.
- The API can boot today with `pnpm --filter @vrs/api dev` after `pnpm db:migrate && pnpm db:seed`.
- The schema is the source of truth — don't bypass Prisma migrations.
- All UI text and copy is written original from scratch — keep that convention going.
