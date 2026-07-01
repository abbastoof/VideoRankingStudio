/**
 * Ranking workflow.
 *
 * A ranking project is a Project of type=RANKING whose settingsJson carries:
 *   { candidates: [{ id, title, score, assetId, thumbnailKey, sourceUrl }],
 *     order: 'asc' | 'desc' }
 *
 * Candidates are the items being ranked (products, videos, songs, etc.).
 * Each has a numeric score the creator assigns manually, or that we compute
 * from an imported metric (YouTube views, TikTok likes, etc.).
 *
 * The ranked-export path builds a full-timeline blueprint from the sorted
 * candidates and hands it to the standard export renderer. Nothing about the
 * FFmpeg compose graph needs to change.
 */

import { randomUUID } from 'node:crypto';

import type { Prisma } from '@vrs/db';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { presignGet } from './storage.service';

export interface RankingCandidate {
  id: string;
  title: string;
  subtitle?: string | null;
  score: number;
  assetId?: string | null;
  thumbnailKey?: string | null;
  sourceUrl?: string | null;
  metadataJson?: Record<string, unknown>;
}

interface RankingSettings {
  candidates: RankingCandidate[];
  order: 'asc' | 'desc';
  headerText?: string;
  brandColor?: string;
  reveal?: 'countdown' | 'topfirst';
}

async function guard(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true, type: true, aspectRatio: true, settingsJson: true, title: true },
  });
  if (!p) throw Errors.projectNotFound();
  if (p.type !== 'RANKING') {
    throw Errors.unprocessable('That project is not a ranking');
  }
  return p;
}

function readSettings(project: { settingsJson: unknown }): RankingSettings {
  const raw = (project.settingsJson as RankingSettings | null) ?? { candidates: [], order: 'desc' };
  return {
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    order: raw.order === 'asc' ? 'asc' : 'desc',
    headerText: raw.headerText,
    brandColor: raw.brandColor,
    reveal: raw.reveal ?? 'countdown',
  };
}

export async function createRankingProject(
  userId: string,
  input: { title: string; aspectRatio?: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5'; order?: 'asc' | 'desc' },
) {
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        userId,
        title: input.title,
        type: 'RANKING',
        aspectRatio: input.aspectRatio ?? 'R9_16',
        settingsJson: { candidates: [], order: input.order ?? 'desc' } as Prisma.InputJsonValue,
      },
    });
    await tx.track.createMany({
      data: [
        { projectId: p.id, kind: 'VIDEO', index: 0 },
        { projectId: p.id, kind: 'AUDIO', index: 0 },
        { projectId: p.id, kind: 'CAPTION', index: 0 },
      ],
    });
    await tx.user.update({
      where: { id: userId },
      data: { projectsCount: { increment: 1 } },
    });
    return p;
  });
  return { id: project.id, title: project.title };
}

export async function getRanking(userId: string, projectId: string) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const enriched = await Promise.all(
    settings.candidates.map(async (c) => ({
      ...c,
      thumbnailUrl: c.thumbnailKey
        ? await presignGet({ bucket: 'public', key: c.thumbnailKey })
        : null,
    })),
  );
  return {
    projectId: p.id,
    title: p.title,
    aspectRatio: p.aspectRatio,
    order: settings.order,
    headerText: settings.headerText ?? null,
    brandColor: settings.brandColor ?? null,
    reveal: settings.reveal ?? 'countdown',
    candidates: sortCandidates(enriched, settings.order),
  };
}

export async function addCandidate(
  userId: string,
  projectId: string,
  input: Omit<RankingCandidate, 'id'>,
) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const next: RankingCandidate = {
    id: randomUUID(),
    title: input.title,
    subtitle: input.subtitle ?? null,
    score: input.score,
    assetId: input.assetId ?? null,
    thumbnailKey: input.thumbnailKey ?? null,
    sourceUrl: input.sourceUrl ?? null,
    metadataJson: input.metadataJson ?? {},
  };
  settings.candidates = [...settings.candidates, next];
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as unknown as Prisma.InputJsonValue, lastEditedAt: new Date() },
  });
  return next;
}

export async function updateCandidate(
  userId: string,
  projectId: string,
  candidateId: string,
  patch: Partial<Omit<RankingCandidate, 'id'>>,
) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const idx = settings.candidates.findIndex((c) => c.id === candidateId);
  if (idx === -1) throw Errors.notFound('Candidate');
  settings.candidates[idx] = { ...settings.candidates[idx]!, ...patch };
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as unknown as Prisma.InputJsonValue, lastEditedAt: new Date() },
  });
  return settings.candidates[idx];
}

export async function removeCandidate(userId: string, projectId: string, candidateId: string) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  settings.candidates = settings.candidates.filter((c) => c.id !== candidateId);
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as unknown as Prisma.InputJsonValue, lastEditedAt: new Date() },
  });
}

export async function reorderCandidates(
  userId: string,
  projectId: string,
  orderedIds: string[],
) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const byId = new Map(settings.candidates.map((c) => [c.id, c]));
  const ordered: RankingCandidate[] = [];
  for (const id of orderedIds) {
    const c = byId.get(id);
    if (c) {
      ordered.push(c);
      byId.delete(id);
    }
  }
  // Any missing ids get appended in their original order to avoid data loss.
  for (const c of byId.values()) ordered.push(c);
  settings.candidates = ordered;
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as unknown as Prisma.InputJsonValue, lastEditedAt: new Date() },
  });
}

export async function updateRankingMeta(
  userId: string,
  projectId: string,
  patch: {
    order?: 'asc' | 'desc';
    headerText?: string | null;
    brandColor?: string | null;
    reveal?: 'countdown' | 'topfirst';
  },
) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  if (patch.order) settings.order = patch.order;
  if (patch.headerText !== undefined) settings.headerText = patch.headerText ?? undefined;
  if (patch.brandColor !== undefined) settings.brandColor = patch.brandColor ?? undefined;
  if (patch.reveal) settings.reveal = patch.reveal;
  await prisma.project.update({
    where: { id: projectId },
    data: { settingsJson: settings as unknown as Prisma.InputJsonValue, lastEditedAt: new Date() },
  });
}

/**
 * Bake a ranking into the timeline before export. Each candidate becomes an
 * OVERLAY text clip layered on top of the VIDEO track; if a candidate has
 * an assetId, that asset drops onto the VIDEO track for the same window.
 *
 * The generated timeline replaces existing clips on the video / overlay
 * tracks so re-baking is idempotent.
 */
export async function bakeTimeline(userId: string, projectId: string) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const sorted = sortCandidates(settings.candidates, settings.order);
  const reveal = settings.reveal ?? 'countdown';
  const slotMs = 4200;
  const introMs = 2500;

  await prisma.$transaction(async (tx) => {
    // Ensure a video + overlay + audio track exist.
    const existing = await tx.track.findMany({ where: { projectId } });
    async function ensureTrack(kind: 'VIDEO' | 'OVERLAY' | 'AUDIO' | 'CAPTION') {
      let t = existing.find((x) => x.kind === kind);
      if (t) return t;
      t = await tx.track.create({ data: { projectId, kind, index: 0 } });
      existing.push(t);
      return t;
    }
    const videoTrack = await ensureTrack('VIDEO');
    const overlayTrack = await ensureTrack('OVERLAY');
    await ensureTrack('CAPTION');

    // Clear old clips on the tracks we own.
    await tx.clip.deleteMany({
      where: { trackId: { in: [videoTrack.id, overlayTrack.id] } },
    });

    let cursor = 0;
    const revealed = reveal === 'topfirst' ? sorted : [...sorted].reverse();

    // Intro title card.
    if (settings.headerText) {
      await tx.clip.create({
        data: {
          trackId: overlayTrack.id,
          source: 'TEXT',
          startMs: 0,
          durationMs: introMs,
          inMs: 0,
          outMs: introMs,
          textJson: {
            text: settings.headerText,
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            background: settings.brandColor ?? '#111111',
            align: 'center',
            animation: 'pop',
          } as Prisma.InputJsonValue,
          metadataJson: { role: 'ranking:intro' } as Prisma.InputJsonValue,
        },
      });
      cursor = introMs;
    }

    for (let i = 0; i < revealed.length; i += 1) {
      const c = revealed[i]!;
      const rank = revealed.length - i; // 1-based rank when counting down
      const start = cursor;

      // Underlying video/image for this candidate (if provided).
      if (c.assetId) {
        const asset = await tx.asset.findFirst({
          where: { id: c.assetId, userId },
          select: { id: true, durationMs: true },
        });
        if (asset) {
          const dur = Math.min(asset.durationMs ?? slotMs, slotMs);
          await tx.clip.create({
            data: {
              trackId: videoTrack.id,
              source: 'ASSET',
              assetId: asset.id,
              startMs: start,
              durationMs: dur,
              inMs: 0,
              outMs: dur,
              metadataJson: { role: 'ranking:card', candidateId: c.id } as Prisma.InputJsonValue,
            },
          });
        }
      }

      // Overlay text: rank + title + subtitle + score line.
      const label = reveal === 'topfirst' ? `#${i + 1}` : `#${rank}`;
      await tx.clip.create({
        data: {
          trackId: overlayTrack.id,
          source: 'TEXT',
          startMs: start,
          durationMs: slotMs,
          inMs: 0,
          outMs: slotMs,
          textJson: {
            text: `${label}  •  ${c.title}${c.subtitle ? `\n${c.subtitle}` : ''}\n${formatScore(c.score)}`,
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            background: settings.brandColor ?? 'rgba(0,0,0,0.65)',
            align: 'center',
            animation: 'fade-in',
          } as Prisma.InputJsonValue,
          metadataJson: {
            role: 'ranking:overlay',
            candidateId: c.id,
            rank,
          } as Prisma.InputJsonValue,
        },
      });
      cursor += slotMs;
    }

    // Recompute cached project duration.
    await tx.project.update({
      where: { id: projectId },
      data: { durationMs: cursor, lastEditedAt: new Date() },
    });
  });

  return { durationMs: 0 };
}

function sortCandidates<T extends { score: number }>(items: T[], order: 'asc' | 'desc'): T[] {
  const copy = [...items];
  copy.sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score));
  return copy;
}

function formatScore(score: number): string {
  if (Math.abs(score) >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (Math.abs(score) >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return `${score}`;
}
