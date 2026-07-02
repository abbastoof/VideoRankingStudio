import { timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';
import { isUserTombstoned, readSession } from '../services/session-cache.service';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string | undefined>)?.[env.SESSION_COOKIE_NAME];
  return cookie ?? null;
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractToken(req);
  if (!token) throw Errors.unauthorized();
  try {
    const payload = await verifyAccessToken(token);
    req.auth = payload;
  } catch {
    throw Errors.sessionInvalid();
  }

  // Redis-cached freshness check — falls through to Postgres on miss.
  const session = await readSession(req.auth.sid);
  if (!session || session.expiresAt < Date.now()) {
    throw Errors.sessionExpired();
  }
  if (session.userDeleted || session.userStatus === 'SUSPENDED') {
    throw Errors.accountSuspended();
  }

  // Tombstone check: if `revokeAllSessionsForUser` was called after this
  // cache entry was written, treat the cached session as revoked.
  if (await isUserTombstoned(session.userId, session.cachedAt)) {
    throw Errors.sessionExpired();
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (req.auth?.role !== 'ADMIN') throw Errors.forbidden('Admin access required');
}

export async function requireInternal(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers['x-internal-service-token'];
  if (typeof header !== 'string') throw Errors.unauthorized();
  // Constant-time compare. String equality on secrets leaks byte-level info
  // through response-timing side channels — an attacker with enough samples
  // can enumerate the token.
  const expected = Buffer.from(env.INTERNAL_SERVICE_TOKEN, 'utf8');
  const provided = Buffer.from(header, 'utf8');
  if (provided.length !== expected.length) throw Errors.unauthorized();
  if (!timingSafeEqual(provided, expected)) throw Errors.unauthorized();
}
