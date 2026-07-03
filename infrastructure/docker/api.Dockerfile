# syntax=docker/dockerfile:1.7
# Production image for @vrs/api.
# Multi-stage: builder generates Prisma client + compiles TS; runtime is slim.

FROM node:20.11.1-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @vrs/db generate
# Build workspace libs before the API. api's tsconfig resolves @vrs/db and
# @vrs/types against their `dist/` output; without this the API compile
# fails with "Cannot find module '@vrs/db'".
RUN pnpm --filter @vrs/types build
RUN pnpm --filter @vrs/db build
RUN pnpm --filter @vrs/api build

# ---------- runtime ----------
FROM node:20.11.1-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl curl tini
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0
WORKDIR /app

# Non-root user
RUN addgroup -S vrs && adduser -S vrs -G vrs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
# pnpm keeps per-package symlinks in apps/api/node_modules. Missing them means
# require('ioredis') can't resolve — the root store has @pnpm/... virtual paths
# but not the flat aliases the runtime code uses.
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/package.json ./

USER vrs
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/index.js"]
