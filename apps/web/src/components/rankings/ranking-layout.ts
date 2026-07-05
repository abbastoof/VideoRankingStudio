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

/** Longest slot a single candidate can occupy (rankings are shorts). */
export const MAX_SLOT_MS = 60_000;
/** Slot length for candidates with no attached video yet. */
export const DEFAULT_SLOT_MS = 4_200;

/**
 * Duration of one candidate's slot in the final video, mirroring the bake:
 * the trimmed range when set, else the full clip, else the default card
 * length. TrimBar shows the same effective end, so the chips never lie.
 */
export function slotDurationMs(c: {
  trimStartMs: number | null;
  trimEndMs: number | null;
  assetDurationMs?: number | null;
}): number {
  const start = c.trimStartMs ?? 0;
  const end = c.trimEndMs ?? c.assetDurationMs ?? null;
  if (end != null && end > start) {
    return Math.min(MAX_SLOT_MS, Math.max(1_000, end - start));
  }
  return DEFAULT_SLOT_MS;
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

/** Per-candidate "Video Title" tab defaults (Viblo uses Rubik 20px-ish). */
export const DEFAULT_CANDIDATE_TITLE_STYLE = {
  fontFamily: 'Rubik',
  fontSize: 44,
  bold: false,
  italic: false,
  color: '#ffffff',
  background: null as string | null,
  strokeColor: '#000000',
  strokeWidth: 0,
};

export interface NumberStyle {
  visible: boolean;
  /** null = use the ranking's accent color. */
  color: string | null;
  fontSize: number;
  position: 'left' | 'center' | 'right';
}

export const DEFAULT_NUMBER_STYLE: NumberStyle = {
  visible: true,
  color: null,
  fontSize: 170,
  position: 'left',
};

export const NUMBER_SIZE_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Small', value: 120 },
  { label: 'Medium', value: 170 },
  { label: 'Large', value: 230 },
];

export function numberXPct(position: NumberStyle['position']): number {
  return { left: 16, center: 50, right: 84 }[position];
}

/**
 * Defensive read of per-candidate styles from metadataJson (untyped JSON —
 * older candidates may have nothing, garbage, or partial objects).
 */
export function candidateStyles(metadataJson: Record<string, unknown> | undefined): {
  titleStyle: typeof DEFAULT_CANDIDATE_TITLE_STYLE;
  numberStyle: NumberStyle;
} {
  const raw = metadataJson ?? {};
  const t = (typeof raw.titleStyle === 'object' && raw.titleStyle !== null ? raw.titleStyle : {}) as Record<string, unknown>;
  const n = (typeof raw.numberStyle === 'object' && raw.numberStyle !== null ? raw.numberStyle : {}) as Record<string, unknown>;
  return {
    titleStyle: {
      ...DEFAULT_CANDIDATE_TITLE_STYLE,
      ...(typeof t.fontFamily === 'string' ? { fontFamily: t.fontFamily } : {}),
      ...(typeof t.fontSize === 'number' ? { fontSize: t.fontSize } : {}),
      ...(typeof t.bold === 'boolean' ? { bold: t.bold } : {}),
      ...(typeof t.italic === 'boolean' ? { italic: t.italic } : {}),
      ...(typeof t.color === 'string' ? { color: t.color } : {}),
      ...(typeof t.background === 'string' || t.background === null
        ? { background: t.background as string | null }
        : {}),
      ...(typeof t.strokeColor === 'string' ? { strokeColor: t.strokeColor } : {}),
      ...(typeof t.strokeWidth === 'number' ? { strokeWidth: t.strokeWidth } : {}),
    },
    numberStyle: {
      ...DEFAULT_NUMBER_STYLE,
      ...(typeof n.visible === 'boolean' ? { visible: n.visible } : {}),
      ...(typeof n.color === 'string' || n.color === null ? { color: n.color as string | null } : {}),
      ...(typeof n.fontSize === 'number' ? { fontSize: n.fontSize } : {}),
      ...(n.position === 'left' || n.position === 'center' || n.position === 'right'
        ? { position: n.position }
        : {}),
    },
  };
}
