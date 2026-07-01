import type { ClipSource, Prisma } from '@vrs/db';

import { prisma } from '../config/db';

export type ClipInput = {
  source: ClipSource;
  assetId?: string | null;
  voiceoverId?: string | null;
  startMs: number;
  durationMs: number;
  inMs?: number;
  outMs?: number;
  speed?: number;
  volume?: number;
  opacity?: number;
  transformJson?: Prisma.InputJsonValue;
  effectsJson?: Prisma.InputJsonValue;
  textJson?: Prisma.InputJsonValue | null;
  metadataJson?: Prisma.InputJsonValue;
  isHighlight?: boolean;
};

export async function trackBelongsToProject(trackId: string, projectId: string) {
  const t = await prisma.track.findFirst({
    where: { id: trackId, projectId },
    select: { id: true },
  });
  return Boolean(t);
}

export function findClip(trackId: string, clipId: string) {
  return prisma.clip.findFirst({ where: { id: clipId, trackId } });
}

export function createClip(trackId: string, input: ClipInput) {
  return prisma.clip.create({
    data: {
      trackId,
      source: input.source,
      assetId: input.assetId ?? null,
      voiceoverId: input.voiceoverId ?? null,
      startMs: input.startMs,
      durationMs: input.durationMs,
      inMs: input.inMs ?? 0,
      outMs: input.outMs ?? input.durationMs,
      speed: input.speed ?? 1,
      volume: input.volume ?? 1,
      opacity: input.opacity ?? 1,
      transformJson: input.transformJson ?? {},
      effectsJson: input.effectsJson ?? [],
      textJson: input.textJson ?? undefined,
      metadataJson: input.metadataJson ?? {},
      isHighlight: input.isHighlight ?? false,
    },
  });
}

export function updateClip(clipId: string, data: Prisma.ClipUpdateInput) {
  return prisma.clip.update({ where: { id: clipId }, data });
}

export function deleteClip(clipId: string) {
  return prisma.clip.delete({ where: { id: clipId } });
}

/**
 * Split a clip at an absolute timeline position (ms). Returns the resulting
 * two clip rows. Idempotency: rejects splits at the exact clip boundary.
 */
export async function splitClip(clipId: string, atMs: number) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.clip.findUniqueOrThrow({ where: { id: clipId } });
    const relative = atMs - clip.startMs;
    if (relative <= 0 || relative >= clip.durationMs) {
      throw new Error('Split position must be strictly inside the clip');
    }

    // Left half keeps the existing row (avoids invalidating references).
    const leftDuration = relative;
    const rightDuration = clip.durationMs - relative;

    await tx.clip.update({
      where: { id: clipId },
      data: {
        durationMs: leftDuration,
        outMs: clip.inMs + Math.round(leftDuration * clip.speed),
      },
    });

    const right = await tx.clip.create({
      data: {
        trackId: clip.trackId,
        source: clip.source,
        assetId: clip.assetId,
        voiceoverId: clip.voiceoverId,
        startMs: atMs,
        durationMs: rightDuration,
        inMs: clip.inMs + Math.round(leftDuration * clip.speed),
        outMs: clip.outMs,
        speed: clip.speed,
        volume: clip.volume,
        opacity: clip.opacity,
        transformJson: clip.transformJson as Prisma.InputJsonValue,
        effectsJson: clip.effectsJson as Prisma.InputJsonValue,
        textJson: (clip.textJson ?? undefined) as Prisma.InputJsonValue | undefined,
        metadataJson: clip.metadataJson as Prisma.InputJsonValue,
        isHighlight: clip.isHighlight,
      },
    });

    const left = await tx.clip.findUniqueOrThrow({ where: { id: clipId } });
    return { left, right };
  });
}

/** Batched reorder — sets startMs and (optionally) new trackId for each clip. */
export async function reorderClips(
  updates: Array<{ id: string; trackId?: string; startMs?: number }>,
) {
  return prisma.$transaction(
    updates.map((u) =>
      prisma.clip.update({
        where: { id: u.id },
        data: {
          ...(u.trackId ? { trackId: u.trackId } : {}),
          ...(u.startMs !== undefined ? { startMs: u.startMs } : {}),
        },
      }),
    ),
  );
}

/** Recalculate the project's cached duration from its clips. */
export async function recomputeProjectDuration(projectId: string) {
  const [row] = await prisma.$queryRaw<{ max_ms: number | null }[]>`
    SELECT MAX(c."startMs" + c."durationMs") AS max_ms
    FROM "Clip" c
    JOIN "Track" t ON t.id = c."trackId"
    WHERE t."projectId" = ${projectId}
  `;
  const duration = row?.max_ms ?? 0;
  await prisma.project.update({
    where: { id: projectId },
    data: { durationMs: duration, lastEditedAt: new Date() },
  });
  return duration;
}
