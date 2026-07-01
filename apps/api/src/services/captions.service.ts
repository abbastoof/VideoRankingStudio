import type { Prisma } from '@vrs/db';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import * as repo from '../repositories/transcripts.repo';
import { presignGet } from './storage.service';

async function guard(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!p) throw Errors.projectNotFound();
}

export async function listTranscripts(userId: string, projectId: string) {
  await guard(userId, projectId);
  const transcripts = await repo.listTranscriptsForProject(userId, projectId);
  return Promise.all(transcripts.map((t) => serialize(t)));
}

export async function getTranscript(userId: string, transcriptId: string) {
  const t = await repo.findTranscript(userId, transcriptId);
  if (!t) throw Errors.notFound('Transcript');
  return serialize(t);
}

export async function updateSegment(
  userId: string,
  transcriptId: string,
  segmentId: string,
  input: { text?: string; startMs?: number; endMs?: number; speakerLabel?: string | null },
) {
  const t = await repo.findTranscript(userId, transcriptId);
  if (!t) throw Errors.notFound('Transcript');
  const res = await repo.updateSegment(transcriptId, segmentId, {
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.startMs !== undefined ? { startMs: input.startMs } : {}),
    ...(input.endMs !== undefined ? { endMs: input.endMs } : {}),
    ...(input.speakerLabel !== undefined ? { speakerLabel: input.speakerLabel } : {}),
  });
  if (res.count === 0) throw Errors.notFound('Segment');
  await recomputeContentText(transcriptId);
  return getTranscript(userId, transcriptId);
}

export async function insertSegment(
  userId: string,
  transcriptId: string,
  input: { index: number; startMs: number; endMs: number; text: string; speakerLabel?: string | null },
) {
  const t = await repo.findTranscript(userId, transcriptId);
  if (!t) throw Errors.notFound('Transcript');
  await repo.createSegment(transcriptId, {
    index: input.index,
    startMs: input.startMs,
    endMs: input.endMs,
    text: input.text,
    speakerLabel: input.speakerLabel ?? null,
  } as never);
  await recomputeContentText(transcriptId);
  return getTranscript(userId, transcriptId);
}

export async function removeSegment(userId: string, transcriptId: string, segmentId: string) {
  const t = await repo.findTranscript(userId, transcriptId);
  if (!t) throw Errors.notFound('Transcript');
  const res = await repo.deleteSegment(transcriptId, segmentId);
  if (res.count === 0) throw Errors.notFound('Segment');
  await recomputeContentText(transcriptId);
}

async function recomputeContentText(transcriptId: string) {
  const segments = await prisma.transcriptSegment.findMany({
    where: { transcriptId },
    orderBy: { index: 'asc' },
    select: { text: true },
  });
  await repo.replaceContentText(transcriptId, segments.map((s) => s.text).join(' '));
}

async function serialize(
  t: NonNullable<Awaited<ReturnType<typeof repo.findTranscript>>>,
): Promise<{
  id: string;
  projectId: string;
  assetId: string | null;
  language: string;
  provider: string;
  status: string;
  durationMs: number;
  srtUrl: string | null;
  vttUrl: string | null;
  segments: Array<{
    id: string;
    index: number;
    startMs: number;
    endMs: number;
    text: string;
    speakerLabel: string | null;
    confidence: number | null;
    words: unknown[] | null;
  }>;
  createdAt: string;
}> {
  const srtUrl = t.srtKey
    ? await presignGet({ bucket: 'generated', key: t.srtKey, expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS })
    : null;
  const vttUrl = t.vttKey
    ? await presignGet({ bucket: 'generated', key: t.vttKey, expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS })
    : null;
  return {
    id: t.id,
    projectId: t.projectId,
    assetId: t.assetId,
    language: t.language,
    provider: t.provider,
    status: t.status,
    durationMs: t.durationMs,
    srtUrl,
    vttUrl,
    segments: t.segments.map((s) => ({
      id: s.id,
      index: s.index,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      speakerLabel: s.speakerLabel,
      confidence: s.confidence,
      words: (s.wordsJson as unknown[] | null) ?? null,
    })),
    createdAt: t.createdAt.toISOString(),
  };
}

/**
 * Caption blocks live on the Project as `Caption` rows (separate from the
 * transcript so they can be styled / animated / disabled independently).
 * This service manages them.
 */

export async function listCaptions(userId: string, projectId: string) {
  await guard(userId, projectId);
  const rows = await prisma.caption.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeCaption);
}

export async function createCaption(
  userId: string,
  projectId: string,
  input: {
    name?: string;
    transcriptId?: string | null;
    styleJson?: Record<string, unknown>;
    segments?: Array<{ startMs: number; endMs: number; text: string }>;
  },
) {
  await guard(userId, projectId);
  const seedSegments = input.segments && input.segments.length > 0
    ? input.segments
    : input.transcriptId
    ? (await prisma.transcriptSegment.findMany({
        where: { transcriptId: input.transcriptId },
        orderBy: { index: 'asc' },
        select: { startMs: true, endMs: true, text: true },
      }))
    : [];
  const row = await prisma.caption.create({
    data: {
      projectId,
      transcriptId: input.transcriptId ?? null,
      name: input.name ?? 'Captions',
      styleJson: (input.styleJson as Prisma.InputJsonValue) ?? {},
      segmentsJson: seedSegments as Prisma.InputJsonValue,
      enabled: true,
    },
  });
  return serializeCaption(row);
}

export async function updateCaption(
  userId: string,
  projectId: string,
  captionId: string,
  input: {
    name?: string;
    enabled?: boolean;
    styleJson?: Record<string, unknown>;
    segmentsJson?: Array<{ startMs: number; endMs: number; text: string }>;
  },
) {
  await guard(userId, projectId);
  const res = await prisma.caption.updateMany({
    where: { id: captionId, projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.styleJson !== undefined ? { styleJson: input.styleJson as Prisma.InputJsonValue } : {}),
      ...(input.segmentsJson !== undefined
        ? { segmentsJson: input.segmentsJson as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
  if (res.count === 0) throw Errors.notFound('Caption');
  const row = await prisma.caption.findUniqueOrThrow({ where: { id: captionId } });
  return serializeCaption(row);
}

export async function deleteCaption(userId: string, projectId: string, captionId: string) {
  await guard(userId, projectId);
  const res = await prisma.caption.deleteMany({ where: { id: captionId, projectId } });
  if (res.count === 0) throw Errors.notFound('Caption');
}

function serializeCaption(c: Awaited<ReturnType<typeof prisma.caption.findUniqueOrThrow>>) {
  return {
    id: c.id,
    projectId: c.projectId,
    transcriptId: c.transcriptId,
    name: c.name,
    enabled: c.enabled,
    styleJson: c.styleJson as Record<string, unknown>,
    segmentsJson: c.segmentsJson as Array<{ startMs: number; endMs: number; text: string }>,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
