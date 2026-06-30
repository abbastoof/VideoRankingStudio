# Contributing

## Workflow

1. Branch from `main` using `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, or `docs/<short-name>`.
2. Make focused commits. Conventional Commits format: `type(scope): subject`.
3. Open a PR. Fill in the template (what / why / how to test / screenshots).
4. CI must be green. At least one reviewer approval required.
5. Squash-merge to `main`. Merge title becomes the changelog entry.

## Commit message format

```
type(scope): short imperative subject (max 72 chars)

Optional body wrapped at 72 chars. Explain *why*, not *what* —
the diff already shows what.

Refs #123
```

**Types:** `feat` · `fix` · `refactor` · `perf` · `docs` · `test` · `chore` · `build` · `ci` · `revert`

**Scopes:** `web` · `api` · `workers` · `db` · `ui` · `types` · `sdk` · `infra` · `ci` · `docs`

## Coding standards

### TypeScript
- `strict: true` everywhere. `any` requires a `// eslint-disable-next-line` with a reason.
- Prefer named exports. Default export only for Next.js pages/layouts.
- Module structure: barrel exports (`index.ts`) at the package level; not inside individual feature folders.
- One responsibility per file. Files over ~300 lines should be split.
- Errors: throw subclasses of `AppError` from `apps/api/src/lib/errors.ts`. Never throw raw strings.

### React
- Server Components by default. Mark `'use client'` only when interactivity is needed.
- Form state via `react-hook-form` + `zod` resolvers.
- Data fetching: TanStack Query in client components, async server components for SSR.
- Hooks named `useThing`. Don't conditionally call hooks. Don't return JSX from hooks.

### Python
- `ruff` for lint + format. `mypy --strict` for types.
- `pydantic` v2 for all data shapes.
- Tasks live in `apps/workers/src/tasks/`, services in `apps/workers/src/services/`.
- IO at the edges; pure functions in the middle.

### Database
- All schema changes go through Prisma migrations (`pnpm db:migrate -- --name <name>`).
- Backward-compatible migrations only (additive). For breaking changes, write a multi-step migration.
- Never use `prisma db push` outside local prototyping.
- Foreign keys + `onDelete` policies must be explicit.

### API
- Every route declares a Zod schema for both input and output.
- Mutating routes accept an `Idempotency-Key` header.
- Responses use a uniform envelope. Errors include a stable `code`.
- Pagination: cursor-based (`cursor`, `limit`, `nextCursor`).

## Testing

| Layer            | Tool                       | Where it lives                  |
| ---------------- | -------------------------- | ------------------------------- |
| Unit             | Vitest (TS) / pytest (PY)  | `*.test.ts` next to source      |
| API integration  | Vitest + supertest          | `apps/api/test/integration/`   |
| Worker functional | pytest + testcontainers     | `apps/workers/tests/`           |
| E2E              | Playwright                 | `apps/web/e2e/`                 |
| Load             | k6                         | `infrastructure/loadtests/`     |
| Contract         | Schemathesis (OpenAPI)     | runs in CI                      |

Coverage targets:
- Service layer: 90%+
- Repository layer: 70%+ (mostly through integration tests)
- UI components: smoke tests for every visible page

## Pull request checklist

- [ ] Tests added/updated; coverage doesn't drop.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passes locally.
- [ ] Updated `PROGRESS.md` if a module status changed.
- [ ] Added/updated documentation if behavior or contracts changed.
- [ ] No secrets, no large binary files, no generated code committed.
- [ ] If touching the DB schema: migration generated, tested against a fresh DB and a populated one.
- [ ] If touching billing or auth: security review tag applied.

## Reviewing

- Read the diff top-to-bottom; understand the *why*.
- Pull the branch and run it for any UI change.
- Block on correctness, security, performance regressions, and unmotivated complexity.
- Don't block on style — Prettier and ESLint do that.

## Releasing

- Versioning: SemVer at the repo level (`vMAJOR.MINOR.PATCH`).
- `git tag vX.Y.Z` triggers the release workflow → staging deploy → manual prod approval.
- Generate the changelog from squashed commit messages between tags.

## Sub-package conventions

- Internal packages are scoped `@vrs/*` (e.g. `@vrs/db`, `@vrs/ui`).
- Don't add a runtime dependency on another internal package unless it ships compiled output (`dist/`).
- Cross-package imports go through the package barrel only — never reach into `dist/` or `src/` paths.
