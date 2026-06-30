import type { ErrorCode } from '@vrs/types';

/**
 * Base class for every error thrown inside the API layer.
 *
 * The global error handler converts these to the standard JSON envelope
 * defined in @vrs/types. Anything that isn't an AppError is treated as an
 * unexpected internal error and gets a generic 500.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly expose: boolean;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
    expose?: boolean;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.details = opts.details;
    this.expose = opts.expose ?? true;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export const Errors = {
  badRequest: (message = 'Bad request', details?: Record<string, unknown>) =>
    new AppError({ code: 'BAD_REQUEST', message, statusCode: 400, details }),
  unauthorized: (message = 'Authentication required') =>
    new AppError({ code: 'UNAUTHORIZED', message, statusCode: 401 }),
  forbidden: (message = 'You do not have permission to do that') =>
    new AppError({ code: 'FORBIDDEN', message, statusCode: 403 }),
  notFound: (resource = 'Resource') =>
    new AppError({ code: 'NOT_FOUND', message: `${resource} not found`, statusCode: 404 }),
  conflict: (message = 'Conflicting state', details?: Record<string, unknown>) =>
    new AppError({ code: 'CONFLICT', message, statusCode: 409, details }),
  tooManyRequests: (message = 'Too many requests, slow down') =>
    new AppError({ code: 'TOO_MANY_REQUESTS', message, statusCode: 429 }),
  unprocessable: (message = 'The request was understood but cannot be processed', details?: Record<string, unknown>) =>
    new AppError({ code: 'UNPROCESSABLE_ENTITY', message, statusCode: 422, details }),
  internal: (message = 'Something went wrong on our end', cause?: unknown) =>
    new AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500, expose: false, cause }),

  otpInvalid: () =>
    new AppError({ code: 'OTP_INVALID', message: 'That code is not correct', statusCode: 400 }),
  otpExpired: () =>
    new AppError({ code: 'OTP_EXPIRED', message: 'That code has expired — request a new one', statusCode: 410 }),
  otpAttemptsExceeded: () =>
    new AppError({
      code: 'OTP_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect codes — request a new one',
      statusCode: 429,
    }),
  otpResendTooSoon: (cooldownSeconds: number) =>
    new AppError({
      code: 'OTP_RESEND_TOO_SOON',
      message: `Wait ${cooldownSeconds} seconds before requesting another code`,
      statusCode: 429,
      details: { cooldownSeconds },
    }),
  sessionInvalid: () =>
    new AppError({ code: 'SESSION_INVALID', message: 'Your session is invalid', statusCode: 401 }),
  sessionExpired: () =>
    new AppError({ code: 'SESSION_EXPIRED', message: 'Your session has expired', statusCode: 401 }),
  accountSuspended: () =>
    new AppError({ code: 'ACCOUNT_SUSPENDED', message: 'This account is suspended', statusCode: 403 }),

  projectNotFound: () =>
    new AppError({ code: 'PROJECT_NOT_FOUND', message: 'Project not found', statusCode: 404 }),
  projectLimitReached: (limit: number) =>
    new AppError({
      code: 'PROJECT_LIMIT_REACHED',
      message: `Your plan allows up to ${limit} videos this month`,
      statusCode: 402,
      details: { limit },
    }),

  voiceConsentRequired: () =>
    new AppError({
      code: 'VOICE_CONSENT_REQUIRED',
      message: 'Voice cloning requires a signed consent declaration',
      statusCode: 422,
    }),
  voiceoverQuotaExceeded: (remaining: number) =>
    new AppError({
      code: 'VOICEOVER_QUOTA_EXCEEDED',
      message: 'You have used your voiceover character quota for this period',
      statusCode: 402,
      details: { remaining },
    }),

  paymentRequired: (planCode?: string) =>
    new AppError({
      code: 'PAYMENT_REQUIRED',
      message: 'This action requires a paid plan',
      statusCode: 402,
      details: planCode ? { recommendedPlan: planCode } : undefined,
    }),

  aiProviderDown: (provider: string) =>
    new AppError({
      code: 'AI_PROVIDER_DOWN',
      message: `${provider} is temporarily unavailable`,
      statusCode: 503,
      details: { provider },
    }),
};
