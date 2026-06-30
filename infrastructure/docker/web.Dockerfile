# syntax=docker/dockerfile:1.7
# Production image for @vrs/web (Next.js 14, standalone output).

FROM node:20.11.1-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter @vrs/web build

FROM node:20.11.1-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache curl tini && addgroup -S vrs && adduser -S vrs -G vrs

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER vrs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
