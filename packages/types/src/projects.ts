import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const projectTypeSchema = z.enum([
  'SHORTS',
  'TEXT_STORY',
  'COMMENTARY',
  'RANKING',
  'TEMPLATE_BASED',
  'IMPORT',
]);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectStatusSchema = z.enum([
  'DRAFT',
  'PROCESSING',
  'READY',
  'ARCHIVED',
  'ERROR',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectAspectRatioSchema = z.enum(['R9_16', 'R16_9', 'R1_1', 'R4_5']);
export type ProjectAspectRatio = z.infer<typeof projectAspectRatioSchema>;

export const projectSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  type: projectTypeSchema,
  status: projectStatusSchema,
  aspectRatio: projectAspectRatioSchema,
  durationMs: z.number().int().nonnegative(),
  thumbnailUrl: z.string().url().nullable(),
  pinned: z.boolean(),
  lastEditedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(160).default('Untitled project'),
  type: projectTypeSchema.default('SHORTS'),
  aspectRatio: projectAspectRatioSchema.default('R9_16'),
  templateId: idSchema.optional(),
  scriptText: z.string().max(20_000).optional(),
  importUrl: z.string().url().optional(),
});
export type CreateProject = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  aspectRatio: projectAspectRatioSchema.optional(),
  scriptText: z.string().max(20_000).nullable().optional(),
  pinned: z.boolean().optional(),
  settingsJson: z.record(z.unknown()).optional(),
});
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export const projectListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: projectStatusSchema.optional(),
  type: projectTypeSchema.optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['lastEditedAt', 'createdAt', 'title']).default('lastEditedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
