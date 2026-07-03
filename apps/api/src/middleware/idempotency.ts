import { createHash } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import { getRedis } from '../config/redis';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Idempotency-Key middleware.
 *
 * Contract:
 *   - Only enforced on state-changing methods (POST/PATCH/PUT/DELETE).
 *   - Header `Idempotency-Key` is optional; if omitted, the request passes through.
 *   - The first request with a given (userId | ip, method, path, key) stores a
 *     hash of the request body plus the response envelope in Redis for 24h.
 *   - A subsequent request with the same key + same body-hash returns the
 *     cached response verbatim (same status code + body).
 *   - A subsequent request with the same key but a *different* body-hash is
 *     rejected with 422 UNPROCESSABLE_ENTITY to catch client bugs early.
 *   - Concurrent requests with the same key see a 409 CONFLICT while the
 *     first is in flight — a lightweight optimistic-lock via SETNX.
 *
 * Design choices:
 *   - Namespace the Redis key by user (or IP when unauthenticated) so keys
 *     don't collide across tenants and one user can't shadow another's.
 *   - Cache full-fidelity response bytes but cap at 256 KiB to stay small.
 *   - Skip caching for streaming / websocket routes (Content-Type null).
 */

const TTL_SECONDS = 24 * 3600;
const IN_FLIGHT_TTL_SECONDS = 60;
const MAX_CACHED_BODY_BYTES = 256 * 1024;

const METHODS_TO_ENFORCE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface CachedResponse {
  statusCode: number;
  contentType: string | null;
  body: string; // base64-encoded to preserve binary safety
  requestBodyHash: string;
  cachedAt: string;
}

// Allow letters, digits, and the ASCII printables Stripe permits. Prevents
// URLs, JWTs, or entire payloads being smuggled in as Idempotency-Key values.
const KEY_FORMAT = /^[A-Za-z0-9_.:@-]{1,255}$/;

function keyFor(scope: string, key: string): string {
  return `idem:${scope}:${key}`;
}

function scopeFrom(req: FastifyRequest): string {
  return req.auth?.sub ?? `ip:${req.ip}`;
}

function hashOf(payload: unknown): string {
  const canonical = payload === undefined ? '' : JSON.stringify(payload);
  return createHash('sha256').update(canonical).digest('hex');
}

function shouldEnforce(req: FastifyRequest): boolean {
  if (!METHODS_TO_ENFORCE.has(req.method)) return false;
  const header = req.headers['idempotency-key'];
  return typeof header === 'string' && header.length > 0;
}

/**
 * Registers the middleware on a Fastify instance. Uses `preHandler` so the
 * request body is already parsed, and `onSend` so we can capture the outgoing
 * response before it's flushed to the wire.
 */
export function registerIdempotency(app: import('fastify').FastifyInstance): void {
  app.addHook('preHandler', async (req, reply) => {
    if (!shouldEnforce(req)) return;
    const rawKey = req.headers['idempotency-key'] as string;
    if (!KEY_FORMAT.test(rawKey)) {
      throw Errors.badRequest(
        'Idempotency-Key must be 1–255 characters of letters, digits, `_ . : @ -`',
      );
    }

    const bodyHash = hashOf(req.body);
    const scope = scopeFrom(req);
    const routeKey = `${req.method} ${req.routeOptions.url ?? req.url}`;
    const cacheKey = keyFor(scope, `${routeKey}:${rawKey}`);
    const inFlightKey = `${cacheKey}:lock`;

    const redis = getRedis();
    const cachedRaw = await redis.get(cacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as CachedResponse;
      if (cached.requestBodyHash !== bodyHash) {
        throw Errors.unprocessable(
          'Idempotency-Key reuse with a different request body',
          { previousHash: cached.requestBodyHash.slice(0, 12), newHash: bodyHash.slice(0, 12) },
        );
      }
      reply.header('Idempotency-Replay', 'true');
      if (cached.contentType) reply.type(cached.contentType);
      const bodyBytes = Buffer.from(cached.body, 'base64');
      reply.code(cached.statusCode).send(bodyBytes);
      return reply;
    }

    // Optimistic in-flight lock. If another request holds it, tell the caller
    // to retry — matches Stripe's semantics for concurrent idempotent posts.
    const gotLock = await redis.set(inFlightKey, '1', 'EX', IN_FLIGHT_TTL_SECONDS, 'NX');
    if (!gotLock) {
      throw Errors.conflict(
        'A request with this Idempotency-Key is already in flight — retry shortly',
      );
    }

    (req as { idempotencyCtx?: unknown }).idempotencyCtx = {
      cacheKey,
      inFlightKey,
      bodyHash,
    };
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const ctx = (req as { idempotencyCtx?: { cacheKey: string; inFlightKey: string; bodyHash: string } })
      .idempotencyCtx;
    if (!ctx) return payload;

    // Only cache success + client-error results. Server errors (5xx) skip the
    // cache so a client can safely retry after the incident.
    if (reply.statusCode >= 500) {
      await getRedis().del(ctx.inFlightKey);
      return payload;
    }

    const buffer = toBuffer(payload);
    if (buffer.length > MAX_CACHED_BODY_BYTES) {
      logger.debug(
        { size: buffer.length, key: ctx.cacheKey },
        'idempotency.response_too_large_skipping_cache',
      );
      await getRedis().del(ctx.inFlightKey);
      return payload;
    }

    const cached: CachedResponse = {
      statusCode: reply.statusCode,
      contentType: reply.getHeader('content-type')?.toString() ?? null,
      body: buffer.toString('base64'),
      requestBodyHash: ctx.bodyHash,
      cachedAt: new Date().toISOString(),
    };
    const redis = getRedis();
    await redis.set(ctx.cacheKey, JSON.stringify(cached), 'EX', TTL_SECONDS);
    await redis.del(ctx.inFlightKey);
    reply.header('Idempotency-Cached', 'true');
    return payload;
  });
}

function toBuffer(payload: unknown): Buffer {
  if (payload === null || payload === undefined) return Buffer.alloc(0);
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === 'string') return Buffer.from(payload);
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  // Fastify streams — we can't safely cache these.
  return Buffer.from('');
}
