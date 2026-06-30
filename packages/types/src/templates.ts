import { z } from 'zod';

import { idSchema, isoDateTimeSchema, slugSchema } from './common';

export const templateSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  previewUrl: z.string().url().nullable(),
  requiredPlan: z.enum(['FREE', 'CREATOR', 'BUSINESS', 'ENTERPRISE']),
  popularity: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
});
export type Template = z.infer<typeof templateSchema>;

export const templateListQuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(['popularity', 'createdAt']).default('popularity'),
});

export const createFromTemplateSchema = z.object({
  templateId: idSchema,
  title: z.string().min(1).max(160).optional(),
  promptVariables: z.record(z.string()).optional(),
});
