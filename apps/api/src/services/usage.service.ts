import type { UsageKind } from '@vrs/db';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';

/**
 * Usage tracking + quota enforcement.
 *
 * The current period for a user is "this calendar month in UTC." Usage
 * records are stored per-(user, kind, periodStart) so historical periods
 * remain queryable and we can do cohort analysis without re-deriving from logs.
 */

function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

async function resolvePlanLimits(userId: string): Promise<Record<string, number>> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });
  if (sub) {
    return sub.plan.limitsJson as Record<string, number>;
  }
  const free = await prisma.plan.findUnique({ where: { code: 'FREE' } });
  return (free?.limitsJson as Record<string, number>) ?? {};
}

const KIND_TO_LIMIT_KEY: Record<UsageKind, string> = {
  VIDEOS_CREATED: 'videosPerMonth',
  VOICEOVER_CHARACTERS: 'voiceoverCharacters',
  TRANSCRIPTION_MINUTES: 'transcriptionMinutes',
  EXPORT_MINUTES: 'exportMinutes',
  IMAGE_GENERATIONS: 'imageGenerations',
  VIDEO_GENERATIONS: 'videoGenerations',
  STORAGE_BYTES: 'storageBytes',
  AI_REQUESTS: 'videosPerMonth', // pooled with monthly count for now
};

export async function getOrCreateUsage(userId: string, kind: UsageKind) {
  const { start, end } = currentPeriod();
  const limits = await resolvePlanLimits(userId);
  const limit = BigInt(limits[KIND_TO_LIMIT_KEY[kind]] ?? -1);

  return prisma.usageRecord.upsert({
    where: { userId_kind_periodStart: { userId, kind, periodStart: start } },
    update: { limit },
    create: { userId, kind, periodStart: start, periodEnd: end, used: 0n, limit },
  });
}

export async function assertWithinLimit(userId: string, kind: UsageKind, requested: number) {
  const rec = await getOrCreateUsage(userId, kind);
  if (rec.limit === -1n) return;
  if (rec.used + BigInt(requested) > rec.limit) {
    if (kind === 'VIDEOS_CREATED') {
      throw Errors.projectLimitReached(Number(rec.limit));
    }
    if (kind === 'VOICEOVER_CHARACTERS') {
      throw Errors.voiceoverQuotaExceeded(Number(rec.limit - rec.used));
    }
    throw Errors.paymentRequired();
  }
}

export async function increment(userId: string, kind: UsageKind, by: number) {
  await getOrCreateUsage(userId, kind);
  const { start } = currentPeriod();
  await prisma.usageRecord.update({
    where: { userId_kind_periodStart: { userId, kind, periodStart: start } },
    data: { used: { increment: BigInt(by) } },
  });
}

/**
 * Atomically check-then-increment usage in a single UPDATE. This is the
 * quota primitive callers should prefer over `assertWithinLimit` +
 * `increment`, which allowed two concurrent requests to both pass the check
 * before either wrote.
 *
 * Returns `true` if the increment succeeded (the caller may proceed) and
 * `false` if it would have pushed the counter over the limit.
 */
export async function tryReserve(
  userId: string,
  kind: UsageKind,
  requested: number,
): Promise<boolean> {
  const record = await getOrCreateUsage(userId, kind);
  // Guarded UPDATE keyed by primary key: only bump `used` when the projected
  // total fits the limit. -1 encodes "unlimited" and always passes.
  //
  // Deliberately NOT matched on periodStart: comparing the naive-timestamp
  // column against a Date param in raw SQL depends on the DB server's
  // timezone — on a non-UTC server the coercion shifts the column, the row
  // never matches, and every reserve fails as a 402.
  const res = await prisma.$executeRaw`
    UPDATE "UsageRecord"
    SET "used" = "used" + ${BigInt(requested)}::bigint
    WHERE "id" = ${record.id}
      AND ("limit" = -1 OR "used" + ${BigInt(requested)}::bigint <= "limit")
  `;
  return Number(res) > 0;
}

/**
 * Atomic reserve that throws the same typed quota errors as the legacy
 * check-then-act API. Prefer this in new code.
 */
export async function assertAndIncrement(
  userId: string,
  kind: UsageKind,
  requested: number,
): Promise<void> {
  const ok = await tryReserve(userId, kind, requested);
  if (ok) return;
  const rec = await getOrCreateUsage(userId, kind);
  if (kind === 'VIDEOS_CREATED') {
    throw Errors.projectLimitReached(Number(rec.limit));
  }
  if (kind === 'VOICEOVER_CHARACTERS') {
    throw Errors.voiceoverQuotaExceeded(Number(rec.limit - rec.used));
  }
  throw Errors.paymentRequired();
}

export async function getSummary(userId: string) {
  const { start, end } = currentPeriod();
  const limits = await resolvePlanLimits(userId);

  const kinds: UsageKind[] = [
    'VIDEOS_CREATED',
    'VOICEOVER_CHARACTERS',
    'TRANSCRIPTION_MINUTES',
    'EXPORT_MINUTES',
    'IMAGE_GENERATIONS',
    'VIDEO_GENERATIONS',
    'STORAGE_BYTES',
  ];

  const records = await prisma.usageRecord.findMany({
    where: { userId, periodStart: start },
  });
  const byKind = new Map(records.map((r) => [r.kind, r]));

  return kinds.map((kind) => {
    const rec = byKind.get(kind);
    const limit = BigInt(limits[KIND_TO_LIMIT_KEY[kind]] ?? -1);
    return {
      kind,
      used: Number(rec?.used ?? 0n),
      limit: Number(rec?.limit ?? limit),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  });
}
