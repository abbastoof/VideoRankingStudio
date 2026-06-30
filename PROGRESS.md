# Progress

This document tracks per-module completion across sessions. It's the **first thing** to read when picking up the project in a new session.

Status legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked

> **Current session focus:** Foundation pass — repo skeleton, schema, infrastructure, scaffolding.

## Roadmap

### Phase 0 — Foundation
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Monorepo skeleton (pnpm + turbo + tsconfig + prettier + editorconfig) | ✅    | `package.json`, `pnpm-workspace.yaml`, `turbo.json`         |
| Top-level documentation (README, ARCHITECTURE, PROGRESS, …)         | ✅    | This file, `README.md`, `ARCHITECTURE.md`                   |
| `.env.example` documenting every variable                           | ✅    | All subsystems covered, grouped                             |
| `.gitignore`, `.editorconfig`, `Makefile`                           | ✅    |                                                             |
| Shared config package (`packages/config`)                           | 🟡    | ESLint + TS presets pending                                 |
| Shared types package (`packages/types`)                             | ⬜    |                                                             |
| Database schema (`packages/db/prisma/schema.prisma`)                | 🟡    |                                                             |
| `docker-compose.yml` for local dev                                  | ⬜    |                                                             |
| Shared UI package (`packages/ui`)                                   | ⬜    | Design tokens + base components                             |
| API service skeleton (`apps/api`)                                   | ⬜    | Fastify + plugins + lifecycle                               |
| Web app skeleton (`apps/web`)                                       | ⬜    | Next.js 14 + Tailwind + layout shell                        |
| Workers skeleton (`apps/workers`)                                   | ⬜    | FastAPI + Celery + one example task                         |
| CI workflow (`.github/workflows/ci.yml`)                            | ⬜    |                                                             |
| Production Dockerfiles                                              | ⬜    |                                                             |
| Terraform skeleton (`infrastructure/terraform`)                     | ⬜    |                                                             |

### Phase 1 — Auth & users
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| OTP request + verify endpoints                                      | ⬜    |                                                             |
| JWT access/refresh tokens, rotation, revocation                     | ⬜    |                                                             |
| Session middleware (Fastify + Next.js server actions)               | ⬜    |                                                             |
| Signup, sign-in, verify-OTP pages                                   | ⬜    |                                                             |
| Profile + settings UI                                               | ⬜    |                                                             |
| Email delivery (SMTP/SendGrid)                                      | ⬜    |                                                             |
| Rate limiting on auth endpoints                                     | ⬜    |                                                             |
| Audit log writes                                                    | ⬜    |                                                             |

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
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Timeline data model (`Track`, `Clip` with `start`, `duration`, `in`/`out`) | ⬜ |                                                             |
| Drag/drop + resize/trim/split clips                                 | ⬜    |                                                             |
| Multi-track + split-screen layouts                                 | ⬜    |                                                             |
| Video preview compositor                                            | ⬜    |                                                             |
| Aspect ratio toggle (9:16, 16:9, 1:1)                               | ⬜    |                                                             |
| Keyboard shortcuts (J/K/L, space, cmd+z, …)                         | ⬜    |                                                             |
| Undo/redo (CRDT or command-log)                                     | ⬜    |                                                             |

### Phase 4 — AI features
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Highlight detection worker (FFmpeg + audio energy + scene cut)     | ⬜    |                                                             |
| Whisper-based transcription                                         | ⬜    |                                                             |
| Caption editor + SRT export                                         | ⬜    |                                                             |
| TTS voiceover (ElevenLabs / Polly / Azure)                          | ⬜    |                                                             |
| Voice cloning (ElevenLabs Pro / Coqui)                              | ⬜    |                                                             |
| Script generation + rewrite (LLM)                                   | ⬜    |                                                             |
| Image generation (Stability / SDXL)                                 | ⬜    |                                                             |
| Video generation (Runway / Pika)                                    | ⬜    |                                                             |

### Phase 5 — Export & publish
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Export job builder (FFmpeg compose graph)                           | ⬜    |                                                             |
| Caption burn-in + animation                                         | ⬜    |                                                             |
| Loudness normalization (EBU R128)                                   | ⬜    |                                                             |
| Watermark for free plan                                             | ⬜    |                                                             |
| Direct publish to YouTube / TikTok (OAuth)                          | ⬜    |                                                             |

### Phase 6 — Billing & quotas
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Stripe customer + subscription provisioning                         | ⬜    |                                                             |
| Plan + price catalog seeded from env                                | ⬜    |                                                             |
| Webhook handler                                                     | ⬜    |                                                             |
| Usage middleware (enforce quotas at request time)                   | ⬜    |                                                             |
| Billing UI: current plan, usage, upgrade, cancel                    | ⬜    |                                                             |
| Customer portal embed                                               | ⬜    |                                                             |

### Phase 7 — Analytics & insights
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| YouTube import for stats (OAuth)                                   | ⬜    |                                                             |
| Insights page (charts)                                              | ⬜    |                                                             |
| Video ranking workflow + UI                                         | ⬜    |                                                             |

### Phase 8 — Admin & operations
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Admin user list + detail                                            | ⬜    |                                                             |
| Subscription management UI                                          | ⬜    |                                                             |
| Support-ticket queue                                                | ⬜    |                                                             |
| Content moderation queue                                            | ⬜    |                                                             |
| Feature-flag toggle UI                                              | ⬜    |                                                             |

### Phase 9 — Production readiness
| Module                                                              | Status | Notes                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Full Terraform (VPC, ECS, RDS, ElastiCache, S3, CF, ACM, R53)       | ⬜    |                                                             |
| Helm/K8s manifests (optional alternative)                           | ⬜    |                                                             |
| Sentry, OTel, Prometheus dashboards                                 | ⬜    |                                                             |
| Runbooks (`docs/RUNBOOKS.md`)                                       | ⬜    |                                                             |
| Load tests (k6) + chaos drills                                      | ⬜    |                                                             |
| Compliance: privacy, ToS, DMCA process                              | ⬜    |                                                             |

## Per-session log

Each session ends with a short log entry: what landed, what's next.

### Session 1 — Foundation
- Initialized monorepo, root configs, .env.example, top-level docs.
- (continuing — see this session's diff for the full list)
- **Next session should start with:** completing any unfinished items in Phase 0, then moving to Phase 1 (Auth & users).
