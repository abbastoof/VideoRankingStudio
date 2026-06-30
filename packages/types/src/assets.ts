import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const assetKindSchema = z.enum(['VIDEO', 'AUDIO', 'IMAGE', 'FONT', 'SUBTITLE']);
export const assetSourceSchema = z.enum(['UPLOAD', 'URL_IMPORT', 'AI_GENERATED', 'TEMPLATE']);
export const assetStatusSchema = z.enum([
  'PENDING_UPLOAD',
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
]);

export const assetSchema = z.object({
  id: idSchema,
  projectId: idSchema.nullable(),
  kind: assetKindSchema,
  source: assetSourceSchema,
  status: assetStatusSchema,
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fps: z.number().nullable(),
  url: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  createdAt: isoDateTimeSchema,
});
export type Asset = z.infer<typeof assetSchema>;

export const uploadInitSchema = z.object({
  projectId: idSchema.optional(),
  kind: assetKindSchema,
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type UploadInit = z.infer<typeof uploadInitSchema>;

export const uploadInitResponseSchema = z.object({
  assetId: idSchema,
  uploadUrl: z.string().url(),
  fields: z.record(z.string()).optional(),
  method: z.enum(['PUT', 'POST']),
  expiresInSeconds: z.number().int().positive(),
});
export type UploadInitResponse = z.infer<typeof uploadInitResponseSchema>;

export const completeUploadSchema = z.object({
  assetId: idSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export const importUrlSchema = z.object({
  projectId: idSchema.optional(),
  url: z.string().url(),
  audioOnly: z.boolean().default(false),
});
export type ImportUrl = z.infer<typeof importUrlSchema>;
