import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const transcriptStatusSchema = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']);

export const transcriptSegmentSchema = z.object({
  id: idSchema,
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  speakerLabel: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  words: z
    .array(
      z.object({
        word: z.string(),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const transcriptSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  assetId: idSchema.nullable(),
  language: z.string(),
  provider: z.string(),
  status: transcriptStatusSchema,
  durationMs: z.number().int().nonnegative(),
  srtUrl: z.string().url().nullable(),
  vttUrl: z.string().url().nullable(),
  segments: z.array(transcriptSegmentSchema),
  createdAt: isoDateTimeSchema,
});
export type Transcript = z.infer<typeof transcriptSchema>;

export const requestTranscriptionSchema = z.object({
  assetId: idSchema.optional(),
  language: z.string().default('auto'),
  diarize: z.boolean().default(false),
});
export type RequestTranscription = z.infer<typeof requestTranscriptionSchema>;

export const updateTranscriptSegmentSchema = z.object({
  text: z.string().min(1).max(1000),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().nonnegative().optional(),
});

export const captionStyleSchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontWeight: z.number().int().min(100).max(900).default(700),
  fontSize: z.number().positive().default(48),
  color: z.string().default('#ffffff'),
  highlightColor: z.string().nullable().default(null),
  background: z.string().nullable().default(null),
  outline: z
    .object({
      color: z.string().default('#000000'),
      width: z.number().nonnegative().default(2),
    })
    .optional(),
  position: z.enum(['top', 'middle', 'bottom']).default('bottom'),
  animation: z.enum(['none', 'word-by-word', 'fade-in', 'pop', 'kinetic']).default('none'),
});
export type CaptionStyle = z.infer<typeof captionStyleSchema>;
