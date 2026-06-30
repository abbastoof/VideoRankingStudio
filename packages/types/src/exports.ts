import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const exportFormatSchema = z.enum([
  'MP4_H264',
  'MP4_H265',
  'WEBM_VP9',
  'MOV_PRORES',
  'GIF',
]);

export const exportStatusSchema = z.enum([
  'QUEUED',
  'RENDERING',
  'UPLOADING',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
]);

export const exportSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  format: exportFormatSchema,
  resolutionW: z.number().int().positive(),
  resolutionH: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationMs: z.number().int().nonnegative().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  status: exportStatusSchema,
  progress: z.number().min(0).max(1),
  downloadUrl: z.string().url().nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  watermark: z.boolean(),
  errorMessage: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
});
export type Export = z.infer<typeof exportSchema>;

export const requestExportSchema = z.object({
  format: exportFormatSchema.default('MP4_H264'),
  resolutionW: z.number().int().min(360).max(3840).default(1080),
  resolutionH: z.number().int().min(360).max(3840).default(1920),
  fps: z.number().int().min(24).max(60).default(30),
  bitrateKbps: z.number().int().min(500).max(50_000).optional(),
  burnCaptions: z.boolean().default(true),
  normalizeLoudness: z.boolean().default(true),
});
export type RequestExport = z.infer<typeof requestExportSchema>;

export const publishProviderSchema = z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM']);

export const requestPublishSchema = z.object({
  exportId: idSchema,
  provider: publishProviderSchema,
  targetId: idSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  privacy: z.enum(['public', 'unlisted', 'private']).default('public'),
});
