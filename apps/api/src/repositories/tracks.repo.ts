import type { Prisma, TrackKind } from '@vrs/db';

import { prisma } from '../config/db';

export function listTracksForProject(projectId: string) {
  return prisma.track.findMany({
    where: { projectId },
    orderBy: [{ kind: 'asc' }, { index: 'asc' }],
    include: {
      clips: {
        orderBy: { startMs: 'asc' },
        include: { asset: true, voiceover: true },
      },
    },
  });
}

export async function createTrack(
  projectId: string,
  data: { kind: TrackKind; index?: number; volume?: number },
) {
  const nextIndex =
    data.index ??
    (await prisma.track.count({ where: { projectId, kind: data.kind } }));
  return prisma.track.create({
    data: {
      projectId,
      kind: data.kind,
      index: nextIndex,
      volume: data.volume ?? 1,
    },
  });
}

export function updateTrack(
  projectId: string,
  trackId: string,
  data: Prisma.TrackUpdateInput,
) {
  return prisma.track.updateMany({
    where: { id: trackId, projectId },
    data,
  });
}

export function deleteTrack(projectId: string, trackId: string) {
  return prisma.track.deleteMany({ where: { id: trackId, projectId } });
}

export async function assertProjectOwnership(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(p);
}
