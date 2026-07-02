import type { User } from '@vrs/db';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/jwt';
import { evictSession, evictSessionsForUser } from './session-cache.service';

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

export interface IssueSessionResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
}

export async function findOrCreateUserByEmail(email: string, name?: string | null): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.deletedAt) {
      throw Errors.accountSuspended();
    }
    if (!existing.emailVerifiedAt) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return existing;
  }
  return prisma.user.create({
    data: {
      email,
      name: name ?? null,
      emailVerifiedAt: new Date(),
    },
  });
}

export async function issueSession(user: User, ctx: SessionContext): Promise<IssueSessionResult> {
  if (user.status === 'SUSPENDED' || user.status === 'PENDING_DELETION') {
    throw Errors.accountSuspended();
  }

  const { token: refreshToken, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hash,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    sid: session.id,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  return { accessToken, refreshToken, expiresAt, sessionId: session.id };
}

export async function rotateSession(refreshToken: string, ctx: SessionContext): Promise<IssueSessionResult> {
  const hash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw Errors.sessionExpired();
  }
  if (session.user.deletedAt || session.user.status !== 'ACTIVE') {
    throw Errors.accountSuspended();
  }

  // Atomic revoke of the current session BEFORE we issue the replacement.
  // Two concurrent refreshes using the same refresh token race here — only
  // one `updateMany({ where: revokedAt: null })` succeeds. The loser sees
  // count === 0 and gets a clean 401 instead of both winning and inflating
  // the user's active-session count off a single stolen token.
  const won = await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (won.count === 0) throw Errors.sessionExpired();

  const { token: nextRefresh, hash: nextHash } = generateRefreshToken();
  const nextExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  const nextSession = await prisma.session.create({
    data: {
      userId: session.userId,
      refreshTokenHash: nextHash,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      expiresAt: nextExpiresAt,
    },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { replacedById: nextSession.id },
  });
  await evictSession(session.id);

  const accessToken = await signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    sid: nextSession.id,
  });

  return { accessToken, refreshToken: nextRefresh, expiresAt: nextExpiresAt, sessionId: nextSession.id };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  await evictSession(sessionId);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await evictSessionsForUser(userId);
}
