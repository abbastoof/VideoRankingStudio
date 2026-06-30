import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

export const notificationKindSchema = z.enum([
  'EXPORT_READY',
  'EXPORT_FAILED',
  'TRANSCRIPTION_READY',
  'VOICE_TRAINED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_CANCELED',
  'TICKET_REPLY',
  'SYSTEM_ANNOUNCEMENT',
  'QUOTA_WARNING',
  'QUOTA_EXCEEDED',
]);

export const notificationSchema = z.object({
  id: idSchema,
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

export const markReadSchema = z.object({
  ids: z.array(idSchema).min(1).max(100),
});

export const ticketStatusSchema = z.enum([
  'OPEN',
  'WAITING_USER',
  'WAITING_SUPPORT',
  'RESOLVED',
  'CLOSED',
]);

export const ticketSchema = z.object({
  id: idSchema,
  subject: z.string(),
  status: ticketStatusSchema,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  category: z.string().nullable(),
  lastMessageAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(20_000),
  category: z.string().max(80).optional(),
  attachments: z.array(idSchema).max(10).optional(),
});
