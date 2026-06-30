import type { Prisma, ProjectStatus, ProjectType } from '@vrs/db';

import { prisma } from '../config/db';

export interface ProjectListFilters {
  userId: string;
  cursor?: string;
  limit: number;
  status?: ProjectStatus;
  type?: ProjectType;
  search?: string;
  sortBy: 'lastEditedAt' | 'createdAt' | 'title';
  sortDir: 'asc' | 'desc';
}

const SUMMARY_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  aspectRatio: true,
  durationMs: true,
  thumbnailKey: true,
  pinned: true,
  lastEditedAt: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

export async function listProjectsForUser(filters: ProjectListFilters) {
  const { userId, cursor, limit, status, type, search, sortBy, sortDir } = filters;
  const where: Prisma.ProjectWhereInput = {
    userId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const items = await prisma.project.findMany({
    where,
    select: SUMMARY_SELECT,
    orderBy: [{ pinned: 'desc' }, { [sortBy]: sortDir }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[limit - 1]?.id ?? null;
    items.pop();
  }
  return { items, nextCursor };
}

export function findProject(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
}

export function findProjectWithTimeline(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      tracks: {
        orderBy: { index: 'asc' },
        include: {
          clips: {
            orderBy: { startMs: 'asc' },
            include: {
              asset: true,
              voiceover: true,
            },
          },
        },
      },
      captions: true,
    },
  });
}

export async function createProject(
  userId: string,
  data: {
    title: string;
    type: ProjectType;
    aspectRatio: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5';
    templateId?: string;
    scriptText?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        userId,
        title: data.title,
        type: data.type,
        aspectRatio: data.aspectRatio,
        templateId: data.templateId ?? null,
        scriptText: data.scriptText ?? null,
      },
      select: SUMMARY_SELECT,
    });

    // Seed three tracks for a sensible default timeline shape.
    await tx.track.createMany({
      data: [
        { projectId: project.id, kind: 'VIDEO', index: 0 },
        { projectId: project.id, kind: 'AUDIO', index: 0 },
        { projectId: project.id, kind: 'CAPTION', index: 0 },
      ],
    });

    await tx.user.update({
      where: { id: userId },
      data: { projectsCount: { increment: 1 } },
    });

    return project;
  });
}

export function updateProject(
  userId: string,
  projectId: string,
  data: Prisma.ProjectUpdateInput,
) {
  return prisma.project.updateMany({
    where: { id: projectId, userId, deletedAt: null },
    data: { ...data, lastEditedAt: new Date() },
  });
}

export function softDeleteProject(userId: string, projectId: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.project.updateMany({
      where: { id: projectId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { projectsCount: { decrement: 1 } },
      });
    }
    return res.count;
  });
}

export function duplicateProject(userId: string, projectId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
      include: { tracks: { include: { clips: true } } },
    });
    if (!source) return null;
    const copy = await tx.project.create({
      data: {
        userId,
        title: `${source.title} (copy)`,
        type: source.type,
        aspectRatio: source.aspectRatio,
        scriptText: source.scriptText,
        settingsJson: source.settingsJson as Prisma.InputJsonValue,
        templateId: source.templateId,
      },
      select: SUMMARY_SELECT,
    });
    for (const track of source.tracks) {
      const newTrack = await tx.track.create({
        data: {
          projectId: copy.id,
          kind: track.kind,
          index: track.index,
          muted: track.muted,
          locked: track.locked,
          volume: track.volume,
        },
      });
      for (const clip of track.clips) {
        await tx.clip.create({
          data: {
            trackId: newTrack.id,
            source: clip.source,
            assetId: clip.assetId,
            voiceoverId: null, // voiceovers are project-bound — regenerate later
            startMs: clip.startMs,
            durationMs: clip.durationMs,
            inMs: clip.inMs,
            outMs: clip.outMs,
            speed: clip.speed,
            volume: clip.volume,
            opacity: clip.opacity,
            transformJson: clip.transformJson as Prisma.InputJsonValue,
            effectsJson: clip.effectsJson as Prisma.InputJsonValue,
            textJson: (clip.textJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            metadataJson: clip.metadataJson as Prisma.InputJsonValue,
            isHighlight: clip.isHighlight,
          },
        });
      }
    }
    await tx.user.update({
      where: { id: userId },
      data: { projectsCount: { increment: 1 } },
    });
    return copy;
  });
}
