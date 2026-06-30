import { z } from 'zod';

import { emailSchema, idSchema, isoDateTimeSchema } from './common';

export const otpRequestSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(120).optional(),
  purpose: z.enum(['SIGN_IN', 'SIGN_UP']).default('SIGN_IN'),
  redirectTo: z.string().url().optional(),
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpRequestResponseSchema = z.object({
  delivered: z.boolean(),
  expiresInSeconds: z.number().int().positive(),
  resendCooldownSeconds: z.number().int().nonnegative(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, '6-digit numeric code required'),
});
export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const sessionUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']),
  locale: z.string(),
  timezone: z.string(),
  planCode: z.enum(['FREE', 'CREATOR', 'BUSINESS', 'ENTERPRISE']),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authSessionSchema = z.object({
  user: sessionUserSchema,
  expiresAt: isoDateTimeSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const signOutResponseSchema = z.object({ ok: z.literal(true) });

export const refreshResponseSchema = z.object({
  expiresAt: isoDateTimeSchema,
});
