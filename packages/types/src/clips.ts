import { z } from 'zod';

import { idSchema } from './common';

export const trackKindSchema = z.enum(['VIDEO', 'AUDIO', 'CAPTION', 'OVERLAY']);
export type TrackKind = z.infer<typeof trackKindSchema>;

export const clipSourceSchema = z.enum([
  'ASSET',
  'VOICEOVER',
  'GENERATED_IMAGE',
  'GENERATED_VIDEO',
  'TEXT',
]);
export type ClipSource = z.infer<typeof clipSourceSchema>;

export const transformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().positive().default(1),
  rotation: z.number().default(0),
  cropTopPct: z.number().min(0).max(1).default(0),
  cropBottomPct: z.number().min(0).max(1).default(0),
  cropLeftPct: z.number().min(0).max(1).default(0),
  cropRightPct: z.number().min(0).max(1).default(0),
});

export const clipEffectSchema = z.object({
  type: z.enum(['fade', 'blur', 'desaturate', 'lut', 'zoom_pan', 'shake']),
  params: z.record(z.unknown()).default({}),
});

export const clipTextSchema = z.object({
  text: z.string().max(500),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().positive().default(48),
  fontWeight: z.number().int().min(100).max(900).default(700),
  /** Synthetic oblique — none of the bundled display fonts ship italics. */
  italic: z.boolean().default(false),
  color: z.string().default('#ffffff'),
  background: z.string().nullable().default(null),
  align: z.enum(['left', 'center', 'right']).default('center'),
  animation: z.enum(['none', 'word-by-word', 'fade-in', 'pop']).default('none'),
  /** Outline drawn around glyphs; width is design-space px (1080-wide canvas). */
  strokeColor: z.string().default('#000000'),
  strokeWidth: z.number().min(0).max(40).default(0),
  /** Block-center position as % of canvas; null = alignment/center fallback. */
  xPct: z.number().min(0).max(100).nullable().default(null),
  yPct: z.number().min(0).max(100).nullable().default(null),
});

export const clipSchema = z.object({
  id: idSchema,
  trackId: idSchema,
  source: clipSourceSchema,
  assetId: idSchema.nullable(),
  voiceoverId: idSchema.nullable(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  inMs: z.number().int().nonnegative(),
  outMs: z.number().int().nonnegative(),
  speed: z.number().positive().default(1),
  volume: z.number().min(0).max(2).default(1),
  opacity: z.number().min(0).max(1).default(1),
  transform: transformSchema.optional(),
  effects: z.array(clipEffectSchema).default([]),
  text: clipTextSchema.optional(),
  isHighlight: z.boolean().default(false),
});
export type Clip = z.infer<typeof clipSchema>;

export const trackSchema = z.object({
  id: idSchema,
  kind: trackKindSchema,
  index: z.number().int().nonnegative(),
  muted: z.boolean(),
  locked: z.boolean(),
  volume: z.number().min(0).max(2),
  clips: z.array(clipSchema),
});
export type Track = z.infer<typeof trackSchema>;

export const timelineSchema = z.object({
  projectId: idSchema,
  durationMs: z.number().int().nonnegative(),
  tracks: z.array(trackSchema),
});
export type Timeline = z.infer<typeof timelineSchema>;

export const createTrackSchema = z.object({
  kind: trackKindSchema,
  index: z.number().int().nonnegative().optional(),
  volume: z.number().min(0).max(2).optional(),
});
export type CreateTrack = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = z.object({
  muted: z.boolean().optional(),
  locked: z.boolean().optional(),
  volume: z.number().min(0).max(2).optional(),
  index: z.number().int().nonnegative().optional(),
});
export type UpdateTrack = z.infer<typeof updateTrackSchema>;

export const createClipSchema = z.object({
  trackId: idSchema,
  source: clipSourceSchema,
  assetId: idSchema.nullable().optional(),
  voiceoverId: idSchema.nullable().optional(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  inMs: z.number().int().nonnegative().optional(),
  outMs: z.number().int().nonnegative().optional(),
  speed: z.number().positive().optional(),
  volume: z.number().min(0).max(2).optional(),
  opacity: z.number().min(0).max(1).optional(),
  transform: transformSchema.optional(),
  effects: z.array(clipEffectSchema).optional(),
  text: clipTextSchema.optional(),
  isHighlight: z.boolean().optional(),
});
export type CreateClip = z.infer<typeof createClipSchema>;

export const updateClipSchema = createClipSchema.partial().omit({ trackId: true });
export type UpdateClip = z.infer<typeof updateClipSchema>;

export const moveClipSchema = z.object({
  trackId: idSchema.optional(),
  startMs: z.number().int().nonnegative().optional(),
});
export type MoveClip = z.infer<typeof moveClipSchema>;

export const splitClipSchema = z.object({ atMs: z.number().int().positive() });
export type SplitClip = z.infer<typeof splitClipSchema>;

export const reorderClipsSchema = z.object({
  updates: z
    .array(
      z.object({
        id: idSchema,
        trackId: idSchema.optional(),
        startMs: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type ReorderClips = z.infer<typeof reorderClipsSchema>;
