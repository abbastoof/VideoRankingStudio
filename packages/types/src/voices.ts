import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const voiceProviderSchema = z.enum([
  'ELEVENLABS',
  'AZURE',
  'POLLY',
  'COQUI',
  'PLAYHT',
  'INTERNAL',
]);

export const voiceKindSchema = z.enum(['STOCK', 'CLONED']);

export const voiceStatusSchema = z.enum(['TRAINING', 'READY', 'FAILED', 'DISABLED']);

export const voiceSchema = z.object({
  id: idSchema,
  kind: voiceKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  provider: voiceProviderSchema,
  status: voiceStatusSchema,
  language: z.string(),
  gender: z.string().nullable(),
  ageGroup: z.string().nullable(),
  previewUrl: z.string().url().nullable(),
  trainingProgress: z.number().min(0).max(1).nullable(),
  charactersUsed: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
});
export type Voice = z.infer<typeof voiceSchema>;

export const cloneVoiceSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  consentSignedAt: isoDateTimeSchema,
  sampleAssetIds: z.array(idSchema).min(1).max(20),
});
export type CloneVoice = z.infer<typeof cloneVoiceSchema>;

export const voiceoverStatusSchema = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']);

export const voiceoverSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  voiceId: idSchema,
  scriptText: z.string(),
  status: voiceoverStatusSchema,
  audioUrl: z.string().url().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  charactersUsed: z.number().int().nonnegative(),
  speed: z.number().positive(),
  pitch: z.number(),
  createdAt: isoDateTimeSchema,
});
export type Voiceover = z.infer<typeof voiceoverSchema>;

export const generateVoiceoverSchema = z.object({
  voiceId: idSchema,
  scriptText: z.string().min(1).max(200_000),
  speed: z.number().min(0.5).max(2).default(1.0),
  pitch: z.number().min(-12).max(12).default(0),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  styleJson: z.record(z.unknown()).optional(),
  insertOnTrackId: idSchema.optional(),
  insertAtMs: z.number().int().nonnegative().optional(),
});
export type GenerateVoiceover = z.infer<typeof generateVoiceoverSchema>;
