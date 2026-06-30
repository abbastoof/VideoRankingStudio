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
