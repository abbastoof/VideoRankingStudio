import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const aiJobKindSchema = z.enum([
  'HIGHLIGHT_DETECTION',
  'TRANSCRIPTION',
  'VOICEOVER',
  'VOICE_CLONE_TRAIN',
  'SCRIPT_GENERATE',
  'SCRIPT_REWRITE',
  'IMAGE_GENERATE',
  'VIDEO_GENERATE',
  'EXPORT_RENDER',
  'URL_IMPORT',
  'THUMBNAIL_GENERATE',
]);
export type AiJobKind = z.infer<typeof aiJobKindSchema>;

export const aiJobStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  'RETRYING',
]);
export type AiJobStatus = z.infer<typeof aiJobStatusSchema>;

export const aiJobSchema = z.object({
  id: idSchema,
  projectId: idSchema.nullable(),
  kind: aiJobKindSchema,
  status: aiJobStatusSchema,
  progress: z.number().min(0).max(1).default(0),
  attempts: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  resultJson: z.record(z.unknown()).nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type AiJob = z.infer<typeof aiJobSchema>;

export const generateHighlightsSchema = z.object({
  assetId: idSchema,
  targetDurationMs: z.number().int().min(5_000).max(180_000).default(60_000),
  maxClips: z.number().int().min(1).max(40).default(8),
  includeFaceTracking: z.boolean().default(true),
});
export type GenerateHighlights = z.infer<typeof generateHighlightsSchema>;

export const generateScriptSchema = z.object({
  topic: z.string().min(1).max(500),
  tone: z
    .enum(['neutral', 'casual', 'energetic', 'educational', 'dramatic'])
    .default('neutral'),
  durationMs: z.number().int().min(15_000).max(300_000).default(60_000),
  format: z
    .enum(['listicle', 'story', 'commentary', 'tutorial', 'ranking'])
    .default('listicle'),
  language: z.string().default('en'),
});
export type GenerateScript = z.infer<typeof generateScriptSchema>;

export const rewriteScriptSchema = z.object({
  text: z.string().min(1).max(20_000),
  goal: z
    .enum(['clarify', 'shorten', 'punchier', 'simpler', 'translate'])
    .default('clarify'),
  targetLanguage: z.string().optional(),
});
export type RewriteScript = z.infer<typeof rewriteScriptSchema>;

export const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(2000).optional(),
  width: z.number().int().multipleOf(64).default(1024),
  height: z.number().int().multipleOf(64).default(1024),
  count: z.number().int().min(1).max(4).default(1),
  style: z.string().optional(),
});
export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const generateVideoSchema = z.object({
  prompt: z.string().min(1).max(2000),
  durationMs: z.number().int().min(2000).max(20_000).default(4000),
  seedAssetId: idSchema.optional(),
  width: z.number().int().multipleOf(64).default(768),
  height: z.number().int().multipleOf(64).default(1344),
});
export type GenerateVideo = z.infer<typeof generateVideoSchema>;

export const generateThumbnailSchema = z.object({
  assetId: idSchema,
  atSeconds: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
});
export type GenerateThumbnail = z.infer<typeof generateThumbnailSchema>;

export const jobProgressEventSchema = z.object({
  jobId: idSchema,
  status: aiJobStatusSchema,
  progress: z.number().min(0).max(1),
  message: z.string().optional(),
  resultJson: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  at: isoDateTimeSchema,
});
export type JobProgressEvent = z.infer<typeof jobProgressEventSchema>;

export const enqueueJobResponseSchema = z.object({
  jobId: idSchema,
});
export type EnqueueJobResponse = z.infer<typeof enqueueJobResponseSchema>;
