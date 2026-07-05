/**
 * Ranking workflow.
 *
 * A ranking project is a Project of type=RANKING whose settingsJson carries:
 *   { candidates: [...], order, orderMode, headerText, titleStyle,
 *     backgroundColor, videoHeightPct, captionsEnabled, reveal, brandColor }
 *
 * Candidates are the items being ranked (products, videos, songs, etc.).
 * Each has a numeric score the creator assigns manually, or that we compute
 * from an imported metric (YouTube views, TikTok likes, etc.). With
 * orderMode='custom' the stored array order wins instead of the score sort.
 *
 * The ranked-export path builds a full-timeline blueprint from the ordered
 * candidates and hands it to the standard export renderer: per slot a video
 * clip (letterboxed at videoHeightPct), a stylized rank-number TEXT clip,
 * and a video-title TEXT clip; plus an always-on ranking-title TEXT clip.
 */

import { randomUUID } from 'node:crypto';

import type { Prisma } from '@vrs/db';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { presignGet } from './storage.service';
import * as usage from './usage.service';

export interface RankingCandidate {
  id: string;
  title: string;
  subtitle?: string | null;
  score: number;
  assetId?: string | null;
  thumbnailKey?: string | null;
  sourceUrl?: string | null;
  trimStartMs?: number | null;
  trimEndMs?: number | null;
  volume?: number;
  metadataJson?: Record<string, unknown>;
}

export interface RankingTitleStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  /** Pill behind the text; null/undefined = no background. */
  background?: string | null;
  strokeColor?: string;
  strokeWidth?: number;
  xPct?: number | null;
  yPct?: number | null;
}

interface RankingSettings {
  candidates: RankingCandidate[];
  order: 'asc' | 'desc';
  orderMode: 'score' | 'custom';
  headerText?: string;
  brandColor?: string;
  reveal?: 'countdown' | 'topfirst';
  titleStyle?: RankingTitleStyle;
  backgroundColor?: string;
  videoHeightPct?: number;
  captionsEnabled?: boolean;
}

const DEFAULT_SLOT_MS = 4200;
const MIN_SLOT_MS = 1000;
const MAX_SLOT_MS = 60_000;

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
  const raw = (project.settingsJson as Partial<RankingSettings> | null) ?? {};
  return {
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    order: raw.order === 'asc' ? 'asc' : 'desc',
    orderMode: raw.orderMode === 'custom' ? 'custom' : 'score',
    headerText: raw.headerText,
    brandColor: raw.brandColor,
    reveal: raw.reveal ?? 'countdown',
    titleStyle: raw.titleStyle,
    backgroundColor: raw.backgroundColor,
    videoHeightPct: raw.videoHeightPct,
    captionsEnabled: raw.captionsEnabled,
  };
}

/**
 * Serialized read-modify-write over settingsJson.
 *
 * The builder UI fires debounced meta PATCHes and immediate candidate
 * PATCHes concurrently; two plain read-modify-writes interleaving would
 * silently drop one side's changes (worst case: the whole candidates
 * array). A row lock makes the second writer wait and re-read.
 */
async function mutateSettings<T>(
  userId: string,
  projectId: string,
  fn: (settings: RankingSettings) => T | Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ settingsJson: unknown; type: string }>>`
      SELECT "settingsJson", "type" FROM "Project"
      WHERE "id" = ${projectId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw Errors.projectNotFound();
    if (row.type !== 'RANKING') throw Errors.unprocessable('That project is not a ranking');
    const settings = readSettings({ settingsJson: row.settingsJson });
    const out = await fn(settings);
    await tx.project.update({
      where: { id: projectId },
      data: {
        settingsJson: settings as unknown as Prisma.InputJsonValue,
        lastEditedAt: new Date(),
      },
    });
    return out;
  });
}

export async function createRankingProject(
  userId: string,
  input: { title: string; aspectRatio?: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5'; order?: 'asc' | 'desc' },
) {
  // Ranking projects count against the same monthly quota as regular
  // projects — a user could otherwise blow past their Free-tier limit by
  // just picking the ranking template.
  await usage.assertAndIncrement(userId, 'VIDEOS_CREATED', 1);
  try {
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          userId,
          title: input.title,
          type: 'RANKING',
          aspectRatio: input.aspectRatio ?? 'R9_16',
          settingsJson: {
            candidates: [],
            order: input.order ?? 'desc',
            orderMode: 'custom',
            backgroundColor: '#2b2a2a',
            videoHeightPct: 80,
            captionsEnabled: false,
          } as Prisma.InputJsonValue,
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
  } catch (err) {
    // Refund the quota so a downstream failure doesn't burn a monthly slot.
    await usage.increment(userId, 'VIDEOS_CREATED', -1);
    throw err;
  }
}

export async function getRanking(userId: string, projectId: string) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const ordered = orderCandidates(settings);

  // Attach playable URLs + durations for candidates with a ready asset.
  const assetIds = ordered.map((c) => c.assetId).filter((x): x is string => Boolean(x));
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, userId },
        select: {
          id: true,
          status: true,
          s3Bucket: true,
          s3Key: true,
          durationMs: true,
          width: true,
          height: true,
          thumbnailKey: true,
        },
      })
    : [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const enriched = await Promise.all(
    ordered.map(async (c) => {
      const asset = c.assetId ? assetById.get(c.assetId) : undefined;
      let assetUrl: string | null = null;
      if (asset && (asset.status === 'READY' || asset.status === 'UPLOADED') && asset.s3Key) {
        assetUrl = await presignGet({
          bucket: asset.s3Bucket as 'uploads' | 'generated' | 'exports' | 'public',
          key: asset.s3Key,
        });
      }
      const thumbKey = c.thumbnailKey ?? asset?.thumbnailKey ?? null;
      return {
        ...c,
        trimStartMs: c.trimStartMs ?? null,
        trimEndMs: c.trimEndMs ?? null,
        volume: c.volume ?? 1,
        assetStatus: asset?.status ?? null,
        assetDurationMs: asset?.durationMs ?? null,
        assetUrl,
        thumbnailUrl: thumbKey ? await presignGet({ bucket: 'public', key: thumbKey }) : null,
      };
    }),
  );

  return {
    projectId: p.id,
    title: p.title,
    aspectRatio: p.aspectRatio,
    order: settings.order,
    orderMode: settings.orderMode,
    headerText: settings.headerText ?? null,
    brandColor: settings.brandColor ?? null,
    reveal: settings.reveal ?? 'countdown',
    titleStyle: settings.titleStyle ?? null,
    backgroundColor: settings.backgroundColor ?? '#2b2a2a',
    videoHeightPct: settings.videoHeightPct ?? 80,
    captionsEnabled: settings.captionsEnabled ?? false,
    candidates: enriched,
  };
}

export async function addCandidate(
  userId: string,
  projectId: string,
  input: Omit<RankingCandidate, 'id'>,
) {
  return mutateSettings(userId, projectId, (settings) => {
    const next: RankingCandidate = {
      id: randomUUID(),
      title: input.title,
      subtitle: input.subtitle ?? null,
      score: input.score,
      assetId: input.assetId ?? null,
      thumbnailKey: input.thumbnailKey ?? null,
      sourceUrl: input.sourceUrl ?? null,
      trimStartMs: input.trimStartMs ?? null,
      trimEndMs: input.trimEndMs ?? null,
      volume: input.volume ?? 1,
      metadataJson: input.metadataJson ?? {},
    };
    settings.candidates = [...settings.candidates, next];
    return next;
  });
}

export async function updateCandidate(
  userId: string,
  projectId: string,
  candidateId: string,
  patch: Partial<Omit<RankingCandidate, 'id'>>,
) {
  return mutateSettings(userId, projectId, (settings) => {
    const idx = settings.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) throw Errors.notFound('Candidate');
    settings.candidates[idx] = { ...settings.candidates[idx]!, ...patch };
    return settings.candidates[idx];
  });
}

export async function removeCandidate(userId: string, projectId: string, candidateId: string) {
  await mutateSettings(userId, projectId, (settings) => {
    settings.candidates = settings.candidates.filter((c) => c.id !== candidateId);
  });
}

export async function reorderCandidates(
  userId: string,
  projectId: string,
  orderedIds: string[],
) {
  await mutateSettings(userId, projectId, (settings) => {
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
  });
}

export async function updateRankingMeta(
  userId: string,
  projectId: string,
  patch: {
    order?: 'asc' | 'desc';
    orderMode?: 'score' | 'custom';
    headerText?: string | null;
    brandColor?: string | null;
    reveal?: 'countdown' | 'topfirst';
    titleStyle?: RankingTitleStyle | null;
    backgroundColor?: string | null;
    videoHeightPct?: number | null;
    captionsEnabled?: boolean;
  },
) {
  await mutateSettings(userId, projectId, (settings) => {
    if (patch.order) settings.order = patch.order;
    if (patch.orderMode) settings.orderMode = patch.orderMode;
    if (patch.headerText !== undefined) settings.headerText = patch.headerText ?? undefined;
    if (patch.brandColor !== undefined) settings.brandColor = patch.brandColor ?? undefined;
    if (patch.reveal) settings.reveal = patch.reveal;
    if (patch.titleStyle !== undefined) settings.titleStyle = patch.titleStyle ?? undefined;
    if (patch.backgroundColor !== undefined) {
      settings.backgroundColor = patch.backgroundColor ?? undefined;
    }
    if (patch.videoHeightPct !== undefined) {
      settings.videoHeightPct = patch.videoHeightPct ?? undefined;
    }
    if (patch.captionsEnabled !== undefined) settings.captionsEnabled = patch.captionsEnabled;
  });
}

/**
 * Bake a ranking into the timeline before export.
 *
 * Layout (design space, canvas = 100% x 100%):
 *   - ranking title: always-on TEXT clip near the top (yPct 6).
 *   - per slot: the candidate's asset letterboxed at videoHeightPct
 *     (transformJson.scale), a big stylized rank number top-left, and the
 *     candidate title just above the video block.
 *
 * The generated timeline replaces existing clips on the video / overlay
 * tracks so re-baking is idempotent.
 */
export async function bakeTimeline(userId: string, projectId: string) {
  const p = await guard(userId, projectId);
  const settings = readSettings(p);
  const ordered = orderCandidates(settings);
  const reveal = settings.reveal ?? 'countdown';
  const revealed = reveal === 'topfirst' ? ordered : [...ordered].reverse();

  const heightPct = clampPct(settings.videoHeightPct ?? 80);
  const videoTopPct = (100 - heightPct) / 2;
  const titleStyle = settings.titleStyle ?? {};
  const brand = settings.brandColor ?? '#f97316';

  // Resolve every referenced asset up front — slot lengths depend on clip
  // durations, and one findMany beats a query per candidate inside the tx.
  const assetIds = revealed.map((c) => c.assetId).filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, userId },
        select: { id: true, durationMs: true },
      })
    : [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  // Pre-compute slot windows: trimmed range, else full clip, else default.
  const slots = revealed.map((c) => ({
    candidate: c,
    asset: c.assetId ? assetById.get(c.assetId) ?? null : null,
    durationMs: slotDuration(c, c.assetId ? assetById.get(c.assetId)?.durationMs ?? null : null),
  }));
  const totalMs = slots.reduce((sum, s) => sum + s.durationMs, 0);

  await prisma.$transaction(async (tx) => {
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

    const clips: Prisma.ClipCreateManyInput[] = [];

    // Always-on ranking title.
    if (settings.headerText && totalMs > 0) {
      clips.push({
        trackId: overlayTrack.id,
        source: 'TEXT',
        startMs: 0,
        durationMs: totalMs,
        inMs: 0,
        outMs: totalMs,
        textJson: {
          text: settings.headerText,
          fontFamily: titleStyle.fontFamily ?? 'Archivo Black',
          fontSize: titleStyle.fontSize ?? 64,
          fontWeight: titleStyle.bold === false ? 400 : 800,
          italic: titleStyle.italic ?? false,
          color: titleStyle.color ?? '#ffffff',
          background: titleStyle.background ?? null,
          align: 'center',
          animation: 'fade-in',
          strokeColor: titleStyle.strokeColor ?? '#000000',
          strokeWidth: titleStyle.strokeWidth ?? 0,
          xPct: titleStyle.xPct ?? null,
          yPct: titleStyle.yPct ?? 6,
        } as Prisma.InputJsonValue,
        metadataJson: { role: 'ranking:header' } as Prisma.InputJsonValue,
      });
    }

    let cursor = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const { candidate: c, asset, durationMs } = slots[i]!;
      // Rank counts down to #1 in countdown mode, up from #1 in topfirst.
      const rank = reveal === 'topfirst' ? i + 1 : slots.length - i;
      const start = cursor;

      // Underlying video for this candidate (if attached and ready).
      if (asset) {
        const inMs = Math.max(0, c.trimStartMs ?? 0);
        clips.push({
          trackId: videoTrack.id,
          source: 'ASSET',
          assetId: asset.id,
          startMs: start,
          durationMs,
          inMs,
          outMs: inMs + durationMs,
          volume: c.volume ?? 1,
          transformJson: { scale: heightPct / 100 } as Prisma.InputJsonValue,
          metadataJson: { role: 'ranking:card', candidateId: c.id } as Prisma.InputJsonValue,
        });
      }

      // Per-candidate styles from the card's Video Title / Number tabs.
      const styles = candidateOverlayStyles(c.metadataJson);

      // Big stylized rank number (hideable, positionable).
      if (styles.number.visible) {
        clips.push({
          trackId: overlayTrack.id,
          source: 'TEXT',
          startMs: start,
          durationMs,
          inMs: 0,
          outMs: durationMs,
          textJson: {
            text: `${rank}.`,
            fontFamily: 'Archivo Black',
            fontSize: styles.number.fontSize,
            fontWeight: 800,
            italic: false,
            color: styles.number.color ?? brand,
            background: null,
            align: 'left',
            animation: 'pop',
            strokeColor: '#000000',
            strokeWidth: 10,
            xPct: styles.number.xPct,
            // Straddles the video's top corner — clear of both titles.
            // Mirrors computeLayout in apps/web ranking-layout.ts.
            yPct: videoTopPct + 4.5,
          } as Prisma.InputJsonValue,
          metadataJson: {
            role: 'ranking:number',
            candidateId: c.id,
            rank,
          } as Prisma.InputJsonValue,
        });
      }

      // Candidate title just above the video block.
      const titleText = c.subtitle ? `${c.title}\n${c.subtitle}` : c.title;
      clips.push({
        trackId: overlayTrack.id,
        source: 'TEXT',
        startMs: start,
        durationMs,
        inMs: 0,
        outMs: durationMs,
        textJson: {
          text: titleText,
          fontFamily: styles.title.fontFamily,
          fontSize: styles.title.fontSize,
          fontWeight: styles.title.bold ? 700 : 500,
          italic: styles.title.italic,
          color: styles.title.color,
          background: styles.title.background,
          align: 'center',
          animation: 'fade-in',
          strokeColor: styles.title.strokeColor,
          strokeWidth: styles.title.strokeWidth,
          xPct: null,
          // Just above the video edge, clear of the header pill.
          // Mirrors computeLayout in apps/web ranking-layout.ts.
          yPct: Math.max(videoTopPct - 2, 11),
        } as Prisma.InputJsonValue,
        metadataJson: {
          role: 'ranking:overlay',
          candidateId: c.id,
          rank,
        } as Prisma.InputJsonValue,
      });
      cursor += durationMs;
    }

    if (clips.length > 0) {
      await tx.clip.createMany({ data: clips });
    }

    // Recompute cached project duration.
    await tx.project.update({
      where: { id: projectId },
      data: { durationMs: cursor, lastEditedAt: new Date() },
    });
  });

  return { durationMs: totalMs };
}

/**
 * Defensive read of the per-candidate overlay styles stored by the builder's
 * Video Title / Number Appearance tabs (metadataJson is untyped JSON —
 * mirror of candidateStyles in apps/web ranking-layout.ts).
 */
function candidateOverlayStyles(metadataJson: Record<string, unknown> | undefined): {
  title: {
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    color: string;
    background: string | null;
    strokeColor: string;
    strokeWidth: number;
  };
  number: { visible: boolean; color: string | null; fontSize: number; xPct: number };
} {
  const raw = metadataJson ?? {};
  const t = (typeof raw.titleStyle === 'object' && raw.titleStyle !== null
    ? raw.titleStyle
    : {}) as Record<string, unknown>;
  const n = (typeof raw.numberStyle === 'object' && raw.numberStyle !== null
    ? raw.numberStyle
    : {}) as Record<string, unknown>;
  const position = n.position === 'center' ? 50 : n.position === 'right' ? 84 : 16;
  return {
    title: {
      fontFamily: typeof t.fontFamily === 'string' ? t.fontFamily : 'Rubik',
      fontSize: typeof t.fontSize === 'number' ? t.fontSize : 44,
      bold: t.bold === true,
      italic: t.italic === true,
      color: typeof t.color === 'string' ? t.color : '#ffffff',
      background: typeof t.background === 'string' ? t.background : null,
      strokeColor: typeof t.strokeColor === 'string' ? t.strokeColor : '#000000',
      strokeWidth: typeof t.strokeWidth === 'number' ? t.strokeWidth : 0,
    },
    number: {
      visible: n.visible !== false,
      color: typeof n.color === 'string' ? n.color : null,
      fontSize: typeof n.fontSize === 'number' ? n.fontSize : 170,
      xPct: position,
    },
  };
}

/** Stored order when custom; score sort otherwise. */
function orderCandidates<T extends { score: number }>(settings: {
  candidates: T[];
  order: 'asc' | 'desc';
  orderMode: 'score' | 'custom';
}): T[] {
  if (settings.orderMode === 'custom') return [...settings.candidates];
  const copy = [...settings.candidates];
  copy.sort((a, b) => (settings.order === 'asc' ? a.score - b.score : b.score - a.score));
  return copy;
}

/**
 * Slot length: trimmed range when set, else the full clip, else the default
 * card length — mirrored by slotDurationMs in the web builder so preview,
 * TrimBar chips, and export all agree.
 */
function slotDuration(c: RankingCandidate, assetDurationMs: number | null): number {
  const start = c.trimStartMs ?? 0;
  const end = c.trimEndMs ?? assetDurationMs ?? null;
  if (end != null && end > start) {
    return Math.min(MAX_SLOT_MS, Math.max(MIN_SLOT_MS, end - start));
  }
  return DEFAULT_SLOT_MS;
}

function clampPct(v: number): number {
  return Math.min(100, Math.max(10, v));
}
