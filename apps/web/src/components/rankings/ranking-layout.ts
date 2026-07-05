import type { RankingDetail } from '@vrs/sdk';

/**
 * Shared layout math for the ranking composition.
 *
 * The live preview and the server bake (apps/api ranking.service
 * bakeTimeline) must agree on where the number / title / video sit, so the
 * formulas live in one place per side and mirror each other exactly.
 * Positions are percentages of the canvas; font sizes are design-space px
 * (1080-wide portrait canvas).
 */

export const DESIGN_WIDTH = 1080;

export interface RankingLayout {
  videoHeightPct: number;
  videoTopPct: number;
  headerYPct: number;
  numberXPct: number;
  numberYPct: number;
  numberFontSize: number;
  candidateTitleYPct: number;
  candidateTitleFontSize: number;
}

export function computeLayout(ranking: Pick<RankingDetail, 'videoHeightPct'>): RankingLayout {
  const videoHeightPct = Math.min(100, Math.max(10, ranking.videoHeightPct || 80));
  const videoTopPct = (100 - videoHeightPct) / 2;
  return {
    videoHeightPct,
    videoTopPct,
    headerYPct: 6,
    numberXPct: 16,
    numberYPct: Math.max(4, videoTopPct * 0.55),
    numberFontSize: 170,
    candidateTitleYPct: Math.max(8, videoTopPct - 4),
    candidateTitleFontSize: 44,
  };
}

/** Duration of one candidate's slot in the final video, mirroring the bake. */
export function slotDurationMs(c: {
  trimStartMs: number | null;
  trimEndMs: number | null;
}): number {
  const start = c.trimStartMs ?? 0;
  if (c.trimEndMs != null && c.trimEndMs > start) {
    return Math.min(60_000, Math.max(1_000, c.trimEndMs - start));
  }
  return 4_200;
}

export const FONT_SIZE_OPTIONS = [20, 24, 28, 32, 36, 44, 52, 64, 80, 96];

export const DEFAULT_TITLE_STYLE = {
  fontFamily: 'Archivo Black',
  fontSize: 64,
  bold: true,
  italic: false,
  color: '#ffffff',
  background: null as string | null,
  strokeColor: '#000000',
  strokeWidth: 0,
};
