# Testing

Test surfaces, boundaries, and where new tests belong. The short version:
unit tests are cheap and go in `apps/*/test/unit`; integration tests hit a
real Postgres/Redis and go in `apps/api/test/integration`; browser flows
live in `apps/web/e2e`.

## What runs where

| Layer | Tool | Location | What it verifies |
| --- | --- | --- | --- |
| Unit (TS) | Vitest | `apps/api/test/unit`, per-package `test/` | Pure logic — services, helpers, reducers |
| Integration (API) | Vitest + real Postgres/Redis | `apps/api/test/integration` | HTTP surface, middleware, DB invariants, auth |
| Unit (Python) | Pytest | `apps/workers/tests` | Task orchestration with stubbed providers |
| E2E (browser) | Playwright | `apps/web/e2e` | Signed-in dashboard flows, sign-in, editor smoke |
| Load | k6 | `tools/k6` | Rate limits, hot path throughput |

Static checks live alongside:

- `pnpm typecheck` — every package.
- `pnpm lint` — ESLint with `--max-warnings=0` on the API; Next lint on
  the web.

## Running locally

```bash
# Unit + integration
pnpm --filter @vrs/api test          # single run
pnpm --filter @vrs/api test:watch    # watch mode

# Workers
pytest apps/workers/tests

# Typecheck + lint everything
pnpm typecheck
pnpm lint

# E2E — starts a dev web + api under the hood
pnpm --filter web test:e2e:install   # first time only
pnpm --filter web test:e2e
```

Integration tests need real dependencies. `docker compose -f
infra/docker-compose.dev.yml up -d postgres redis` before running.

## Boundaries

The line between unit and integration tests is deliberately drawn to
prevent testing conventions from lying to us:

- **Unit** tests never touch the network, filesystem outside `/tmp`, or a
  DB. Anything hitting Prisma is integration.
- **Integration** tests never mock the DB. We learned this the hard way —
  mocked repositories will happily pass while production migrations break.
  If you need to isolate a slow provider, stub the provider layer, not the
  DB.
- **E2E** tests exercise the compiled app against the compiled API. They
  don't reach into `apps/api`'s in-process code; they hit the real HTTP
  endpoints.

## Coverage targets

We don't chase a global percentage — coverage lies. Instead:

- Every service in `apps/api/src/services` has direct unit or integration
  coverage.
- Every route in `apps/api/src/routes` has at least one happy-path
  integration test plus one auth-boundary check.
- Every worker task has a happy path and one failure path.
- Every landing page and top signed-in view has an E2E smoke test.

## Fixtures

- API integration fixtures live in `apps/api/test/helpers`. They spin up a
  Fastify instance per test file with a fresh schema, seed a plan catalog,
  and return helpers to create users, projects, and sessions.
- Web E2E fixtures live in `apps/web/e2e/helpers`. Auth is handled by
  hitting the API's OTP endpoint directly in test mode — no email round-trip.

## CI

`.github/workflows/ci.yml` runs:

1. `pnpm install`
2. `pnpm typecheck && pnpm lint` — must pass before tests run.
3. `pnpm --filter @vrs/api test` against a Postgres/Redis service.
4. `pytest apps/workers`
5. `pnpm --filter web test:e2e` on a preview build.

Every PR must be green before merge. Deploy is triggered by pushes to
`main` after CI passes.

## Writing a new test

- Name the file after the unit under test, not the scenario: `plans.spec.ts`,
  not `should_create_a_plan.spec.ts`.
- One `describe` per exported function or route path.
- Use factory helpers, not literal fixtures — a `makeUser({...overrides})`
  helper survives schema evolution better than an inline object literal in
  a hundred files.
- Assert on shapes, not on error text — text is copy, shapes are contract.

## Debugging a flaky test

- If you can't reproduce locally in ten runs, do not merge "just to see."
  Flaky tests silently teach the team to ignore CI.
- Common causes: unresolved promises in `afterEach`, shared DB rows
  bleeding across tests (use per-test schemas), and timezone assumptions.
- Playwright flakes are usually the fault of a query racing a network
  transition — use `waitForResponse` or `waitFor(...)` instead of
  `waitForTimeout`.
