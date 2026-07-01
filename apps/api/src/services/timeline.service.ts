import type {
  CreateClip,
  CreateTrack,
  MoveClip,
  ReorderClips,
  UpdateClip,
  UpdateTrack,
} from '@vrs/types';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import * as clipsRepo from '../repositories/clips.repo';
import * as tracksRepo from '../repositories/tracks.repo';
import { presignGet } from './storage.service';

async function guard(userId: string, projectId: string) {
  const ok = await tracksRepo.assertProjectOwnership(userId, projectId);
  if (!ok) throw Errors.projectNotFound();
}

export async function getTimeline(userId: string, projectId: string) {
  await guard(userId, projectId);
  const tracks = await tracksRepo.listTracksForProject(projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { durationMs: true },
  });

  const serialized = await Promise.all(
    tracks.map(async (t) => ({
      id: t.id,
      kind: t.kind,
      index: t.index,
      muted: t.muted,
      locked: t.locked,
      volume: t.volume,
      clips: await Promise.all(t.clips.map((c) => serializeClip(c))),
    })),
  );

  return { projectId, durationMs: project.durationMs, tracks: serialized };
}

async function serializeClip(
  c: NonNullable<Awaited<ReturnType<typeof clipsRepo.findClip>>> & {
    asset?: { s3Bucket: string; s3Key: string; thumbnailKey: string | null } | null;
    voiceover?: { audioBucket: string | null; audioKey: string | null } | null;
  },
) {
  let previewUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  if (c.asset?.s3Bucket && c.asset?.s3Key) {
    previewUrl = await presignGet({
      bucket: c.asset.s3Bucket as 'uploads' | 'generated' | 'exports' | 'public',
      key: c.asset.s3Key,
    });
    if (c.asset.thumbnailKey) {
      thumbnailUrl = await presignGet({ bucket: 'public', key: c.asset.thumbnailKey });
    }
  } else if (c.voiceover?.audioBucket && c.voiceover?.audioKey) {
    previewUrl = await presignGet({
      bucket: c.voiceover.audioBucket as 'generated',
      key: c.voiceover.audioKey,
    });
  }
  return {
    id: c.id,
    trackId: c.trackId,
    source: c.source,
    assetId: c.assetId,
    voiceoverId: c.voiceoverId,
    startMs: c.startMs,
    durationMs: c.durationMs,
    inMs: c.inMs,
    outMs: c.outMs,
    speed: c.speed,
    volume: c.volume,
    opacity: c.opacity,
    transform: c.transformJson as Record<string, unknown> | undefined,
    effects: (c.effectsJson as unknown[]) ?? [],
    text: c.textJson as Record<string, unknown> | undefined,
    isHighlight: c.isHighlight,
    previewUrl,
    thumbnailUrl,
  };
}

// ─── Tracks ─────────────────────────────────────────────────────────────

export async function createTrack(userId: string, projectId: string, input: CreateTrack) {
  await guard(userId, projectId);
  return tracksRepo.createTrack(projectId, input);
}

export async function updateTrack(
  userId: string,
  projectId: string,
  trackId: string,
  input: UpdateTrack,
) {
  await guard(userId, projectId);
  const res = await tracksRepo.updateTrack(projectId, trackId, input);
  if (res.count === 0) throw Errors.notFound('Track');
  return { ok: true as const };
}

export async function deleteTrack(userId: string, projectId: string, trackId: string) {
  await guard(userId, projectId);
  const res = await tracksRepo.deleteTrack(projectId, trackId);
  if (res.count === 0) throw Errors.notFound('Track');
  await clipsRepo.recomputeProjectDuration(projectId);
}

// ─── Clips ──────────────────────────────────────────────────────────────

export async function createClip(userId: string, projectId: string, input: CreateClip) {
  await guard(userId, projectId);
  const trackOk = await clipsRepo.trackBelongsToProject(input.trackId, projectId);
  if (!trackOk) throw Errors.notFound('Track');
  const created = await clipsRepo.createClip(input.trackId, {
    source: input.source,
    assetId: input.assetId ?? null,
    voiceoverId: input.voiceoverId ?? null,
    startMs: input.startMs,
    durationMs: input.durationMs,
    inMs: input.inMs,
    outMs: input.outMs,
    speed: input.speed,
    volume: input.volume,
    opacity: input.opacity,
    transformJson: input.transform as never,
    effectsJson: input.effects as never,
    textJson: input.text as never,
    isHighlight: input.isHighlight,
  });
  await clipsRepo.recomputeProjectDuration(projectId);
  return serializeClipFromDb(created.id);
}

export async function updateClip(
  userId: string,
  projectId: string,
  clipId: string,
  input: UpdateClip,
) {
  await guard(userId, projectId);
  await clipsRepo.updateClip(clipId, {
    ...(input.source ? { source: input.source } : {}),
    ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
    ...(input.voiceoverId !== undefined ? { voiceoverId: input.voiceoverId } : {}),
    ...(input.startMs !== undefined ? { startMs: input.startMs } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.inMs !== undefined ? { inMs: input.inMs } : {}),
    ...(input.outMs !== undefined ? { outMs: input.outMs } : {}),
    ...(input.speed !== undefined ? { speed: input.speed } : {}),
    ...(input.volume !== undefined ? { volume: input.volume } : {}),
    ...(input.opacity !== undefined ? { opacity: input.opacity } : {}),
    ...(input.transform !== undefined ? { transformJson: input.transform as never } : {}),
    ...(input.effects !== undefined ? { effectsJson: input.effects as never } : {}),
    ...(input.text !== undefined ? { textJson: input.text as never } : {}),
    ...(input.isHighlight !== undefined ? { isHighlight: input.isHighlight } : {}),
  });
  await clipsRepo.recomputeProjectDuration(projectId);
  return serializeClipFromDb(clipId);
}

export async function moveClip(
  userId: string,
  projectId: string,
  clipId: string,
  input: MoveClip,
) {
  await guard(userId, projectId);
  if (input.trackId) {
    const trackOk = await clipsRepo.trackBelongsToProject(input.trackId, projectId);
    if (!trackOk) throw Errors.notFound('Track');
  }
  await clipsRepo.updateClip(clipId, {
    ...(input.trackId ? { trackId: input.trackId } : {}),
    ...(input.startMs !== undefined ? { startMs: input.startMs } : {}),
  });
  await clipsRepo.recomputeProjectDuration(projectId);
  return serializeClipFromDb(clipId);
}

export async function splitClip(
  userId: string,
  projectId: string,
  clipId: string,
  atMs: number,
) {
  await guard(userId, projectId);
  const { left, right } = await clipsRepo.splitClip(clipId, atMs);
  await clipsRepo.recomputeProjectDuration(projectId);
  return {
    left: await serializeClipFromDb(left.id),
    right: await serializeClipFromDb(right.id),
  };
}

export async function deleteClip(userId: string, projectId: string, clipId: string) {
  await guard(userId, projectId);
  await clipsRepo.deleteClip(clipId);
  await clipsRepo.recomputeProjectDuration(projectId);
}

export async function reorderClips(
  userId: string,
  projectId: string,
  input: ReorderClips,
) {
  await guard(userId, projectId);
  await clipsRepo.reorderClips(input.updates);
  await clipsRepo.recomputeProjectDuration(projectId);
  return { ok: true as const };
}

async function serializeClipFromDb(clipId: string) {
  const row = await prisma.clip.findUniqueOrThrow({
    where: { id: clipId },
    include: {
      asset: { select: { s3Bucket: true, s3Key: true, thumbnailKey: true } },
      voiceover: { select: { audioBucket: true, audioKey: true } },
    },
  });
  return serializeClip(row);
}
