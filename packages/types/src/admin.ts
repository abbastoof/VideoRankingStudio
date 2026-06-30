import { z } from 'zod';

import { emailSchema, idSchema, isoDateTimeSchema } from './common';
import { planCodeSchema, subscriptionStatusSchema } from './billing';

export const adminUserListItemSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']),
  planCode: planCodeSchema,
  subscriptionStatus: subscriptionStatusSchema.nullable(),
  projectsCount: z.number().int().nonnegative(),
  exportsCount: z.number().int().nonnegative(),
  lastSeenAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminUserListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(200).optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']).optional(),
  planCode: planCodeSchema.optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']).optional(),
});

export const updateUserSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']).optional(),
  planCode: planCodeSchema.optional(),
});

export const adminMetricsSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  activeUsersLast30Days: z.number().int().nonnegative(),
  paidUsers: z.number().int().nonnegative(),
  mrrCents: z.number().int().nonnegative(),
  exportsLast24h: z.number().int().nonnegative(),
  jobBacklog: z.number().int().nonnegative(),
});
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;

export const abuseReportSchema = z.object({
  id: idSchema,
  reporterEmail: z.string().nullable(),
  targetType: z.string(),
  targetId: z.string(),
  reason: z.string(),
  description: z.string().nullable(),
  status: z.enum(['RECEIVED', 'REVIEWING', 'ACTION_TAKEN', 'DISMISSED']),
  createdAt: isoDateTimeSchema,
});
