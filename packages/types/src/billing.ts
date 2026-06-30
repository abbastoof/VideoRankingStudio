import { z } from 'zod';

import { currencySchema, idSchema, isoDateTimeSchema } from './common';

export const planCodeSchema = z.enum(['FREE', 'CREATOR', 'BUSINESS', 'ENTERPRISE']);
export const billingIntervalSchema = z.enum(['MONTH', 'YEAR']);
export const subscriptionStatusSchema = z.enum([
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PAUSED',
]);

export const planLimitsSchema = z.object({
  videosPerMonth: z.number().int(),
  voiceoverCharacters: z.number().int(),
  transcriptionMinutes: z.number().int(),
  exportMinutes: z.number().int(),
  imageGenerations: z.number().int(),
  videoGenerations: z.number().int(),
  storageBytes: z.number().int(),
  cloneVoiceCount: z.number().int(),
  watermark: z.boolean(),
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const planSchema = z.object({
  id: idSchema,
  code: planCodeSchema,
  name: z.string(),
  description: z.string().nullable(),
  monthlyPriceCents: z.number().int().nonnegative(),
  annualPriceCents: z.number().int().nonnegative(),
  currency: currencySchema,
  trialDays: z.number().int().nonnegative(),
  limits: planLimitsSchema,
  features: z.array(z.string()),
  highlight: z.boolean(),
});
export type Plan = z.infer<typeof planSchema>;

export const subscriptionSchema = z.object({
  id: idSchema,
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  interval: billingIntervalSchema,
  currentPeriodStart: isoDateTimeSchema,
  currentPeriodEnd: isoDateTimeSchema,
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: isoDateTimeSchema.nullable(),
  trialEndsAt: isoDateTimeSchema.nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const startCheckoutSchema = z.object({
  planCode: planCodeSchema,
  interval: billingIntervalSchema,
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const startCheckoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
});

export const customerPortalResponseSchema = z.object({
  portalUrl: z.string().url(),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(2000).optional(),
  immediate: z.boolean().default(false),
});

export const usageKindSchema = z.enum([
  'VIDEOS_CREATED',
  'VOICEOVER_CHARACTERS',
  'TRANSCRIPTION_MINUTES',
  'EXPORT_MINUTES',
  'IMAGE_GENERATIONS',
  'VIDEO_GENERATIONS',
  'STORAGE_BYTES',
  'AI_REQUESTS',
]);

export const usageSummarySchema = z.object({
  kind: usageKindSchema,
  used: z.number().int().nonnegative(),
  limit: z.number().int(), // -1 == unlimited
  periodStart: isoDateTimeSchema,
  periodEnd: isoDateTimeSchema,
});
export type UsageSummary = z.infer<typeof usageSummarySchema>;

export const invoiceSchema = z.object({
  id: idSchema,
  number: z.string().nullable(),
  amountCents: z.number().int(),
  currency: currencySchema,
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']),
  hostedInvoiceUrl: z.string().url().nullable(),
  invoicePdfUrl: z.string().url().nullable(),
  periodStart: isoDateTimeSchema,
  periodEnd: isoDateTimeSchema,
  paidAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Invoice = z.infer<typeof invoiceSchema>;
