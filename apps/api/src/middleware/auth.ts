import type { FastifyReply, FastifyRequest } from 'fastify';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';

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

  // Cheap freshness check: ensure session row still exists and isn't revoked.
  const session = await prisma.session.findUnique({
    where: { id: req.auth.sid },
    select: { id: true, revokedAt: true, expiresAt: true, user: { select: { status: true, deletedAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw Errors.sessionExpired();
  }
  if (session.user.deletedAt || session.user.status === 'SUSPENDED') {
    throw Errors.accountSuspended();
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (req.auth?.role !== 'ADMIN') throw Errors.forbidden('Admin access required');
}

export async function requireInternal(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers['x-internal-service-token'];
  if (typeof header !== 'string' || header !== env.INTERNAL_SERVICE_TOKEN) {
    throw Errors.unauthorized();
  }
}
