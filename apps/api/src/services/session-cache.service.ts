/**
 * Session-freshness cache.
 *
 * `requireAuth` hits Postgres on every authenticated request to confirm the
 * Session row still exists, isn't revoked, and hasn't expired. That's a
 * single point-lookup, but it's on the hot path for every dashboard render.
 *
 * We short-cache the freshness in Redis: sessionId → { userId, role, status,
 * expiresAt } with a 60-second TTL. On sign-out / revoke / revoke-all we
 * evict the entry so a stale cache never keeps a compromised session alive
 * for more than the TTL.
 *
 * The cache is intentionally short (60s). Longer TTLs improve hit rate but
 * lengthen the compromise window; 60s is the ratio we're comfortable with
 * for a paid SaaS.
 */

import type { AccountStatus, UserRole } from '@vrs/db';

import { prisma } from '../config/db';
import { getRedis } from '../config/redis';
import { logger } from '../lib/logger';

const TTL_SECONDS = 60;
const CACHE_KEY = (sessionId: string) => `sess:${sessionId}`;

export interface CachedSession {
  sessionId: string;
  userId: string;
  role: UserRole;
  userStatus: AccountStatus;
  userDeleted: boolean;
  expiresAt: number; // epoch ms — session's own expiration
  cachedAt: number;  // epoch ms — when this record was written; used for tombstone comparison
}

export async function readSession(sessionId: string): Promise<CachedSession | null> {
  const redis = getRedis();
  try {
    const raw = await redis.get(CACHE_KEY(sessionId));
    if (raw) return JSON.parse(raw) as CachedSession;
  } catch (err) {
    logger.debug({ err, sessionId }, 'session-cache.read_failed_falling_back_to_db');
  }
  return loadFromDbAndCache(sessionId);
}

async function loadFromDbAndCache(sessionId: string): Promise<CachedSession | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, role: true, status: true, deletedAt: true } },
    },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  const record: CachedSession = {
    sessionId: session.id,
    userId: session.user.id,
    role: session.user.role,
    userStatus: session.user.status,
    userDeleted: Boolean(session.user.deletedAt),
    expiresAt: session.expiresAt.getTime(),
    cachedAt: Date.now(),
  };

  try {
    await getRedis().set(CACHE_KEY(sessionId), JSON.stringify(record), 'EX', TTL_SECONDS);
  } catch (err) {
    logger.debug({ err, sessionId }, 'session-cache.write_failed');
  }
  return record;
}

export async function evictSession(sessionId: string): Promise<void> {
  try {
    await getRedis().del(CACHE_KEY(sessionId));
  } catch (err) {
    logger.debug({ err, sessionId }, 'session-cache.evict_failed');
  }
}

export async function evictSessionsForUser(userId: string): Promise<void> {
  // We don't index sessionId → userId in Redis; on revoke-all we can't fan
  // out one DEL per session cheaply. Instead we tombstone the user's id so
  // any cached-session lookup on their behalf treats the record as stale.
  const stamp = `usertomb:${userId}`;
  try {
    await getRedis().set(stamp, Date.now().toString(), 'EX', TTL_SECONDS + 5);
  } catch (err) {
    logger.debug({ err, userId }, 'session-cache.tombstone_failed');
  }
}

export async function isUserTombstoned(userId: string, sinceMs: number): Promise<boolean> {
  try {
    const raw = await getRedis().get(`usertomb:${userId}`);
    if (!raw) return false;
    return Number(raw) > sinceMs;
  } catch {
    return false;
  }
}
