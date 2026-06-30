import { z } from 'zod';

/**
 * Uniform error envelope returned by every API endpoint on failure.
 * Successful responses return the payload directly (no `data` wrapper) so
 * route declarations stay terse.
 */

export const errorCodeSchema = z.enum([
  // Generic
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GONE',
  'PRECONDITION_FAILED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',

  // Auth
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'OTP_RESEND_TOO_SOON',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',

  // Domain
  'PROJECT_NOT_FOUND',
  'PROJECT_LIMIT_REACHED',
  'ASSET_UPLOAD_FAILED',
  'ASSET_FORMAT_UNSUPPORTED',
  'VOICE_CONSENT_REQUIRED',
  'VOICEOVER_QUOTA_EXCEEDED',
  'TRANSCRIPTION_QUOTA_EXCEEDED',
  'EXPORT_QUOTA_EXCEEDED',
  'EXPORT_DURATION_EXCEEDED',
  'AI_JOB_FAILED',
  'AI_PROVIDER_DOWN',

  // Billing
  'PAYMENT_REQUIRED',
  'SUBSCRIPTION_INACTIVE',
  'PLAN_DOWNGRADE_BLOCKED',
  'STRIPE_CUSTOMER_MISSING',
  'WEBHOOK_SIGNATURE_INVALID',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const idempotencyKeyHeaderSchema = z.string().min(8).max(128);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string(),
  uptime: z.number(),
  checks: z.record(z.object({ status: z.enum(['ok', 'fail']), latencyMs: z.number().optional() })),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
