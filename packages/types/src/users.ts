import { z } from 'zod';

import { emailSchema, idSchema, isoDateTimeSchema, localeSchema } from './common';

export const userProfileSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']),
  locale: localeSchema,
  timezone: z.string(),
  emailVerifiedAt: isoDateTimeSchema.nullable(),
  marketingOptIn: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  imageUrl: z.string().url().nullable().optional(),
  locale: localeSchema.optional(),
  timezone: z.string().optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const requestEmailChangeSchema = z.object({
  newEmail: emailSchema,
});

export const deleteAccountSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  reason: z.string().max(2000).optional(),
});
