import { z } from 'zod';

/**
 * Runtime environment validation. Boot fails fast if a required var is
 * missing or malformed, which beats hunting NPEs at request time.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  TZ: z.string().default('UTC'),

  // Service URLs
  WEB_URL: z.string().url(),
  API_URL: z.string().url(),
  PUBLIC_CDN_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().min(1),
  REDIS_QUEUE_URL: z.string().min(1).optional(),

  // Broker
  BROKER_URL: z.string().min(1).optional(),

  // Storage (S3 / MinIO)
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_BUCKET_UPLOADS: z.string().min(1),
  S3_BUCKET_GENERATED: z.string().min(1),
  S3_BUCKET_EXPORTS: z.string().min(1),
  S3_BUCKET_PUBLIC: z.string().min(1),
  S3_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Auth & sessions
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  SESSION_COOKIE_NAME: z.string().default('vrs_session'),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_SECURE: z.coerce.boolean().default(false),
  SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('VideoRankingStudio'),
  EMAIL_REPLY_TO: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SENDGRID_API_KEY: z.string().optional(),
  SES_REGION: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_CREATOR_MONTHLY: z.string().optional(),
  STRIPE_PRICE_CREATOR_ANNUAL: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_ANNUAL: z.string().optional(),
  STRIPE_CUSTOMER_PORTAL_RETURN_URL: z.string().url().optional(),

  // AI providers (optional, swappable)
  LLM_PROVIDER: z.enum(['anthropic', 'openai', 'local']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  TTS_PROVIDER: z.enum(['elevenlabs', 'azure', 'polly', 'coqui']).default('elevenlabs'),
  ELEVENLABS_API_KEY: z.string().optional(),
  STT_PROVIDER: z.enum(['openai_whisper', 'local_whisper', 'google', 'deepgram']).default('openai_whisper'),
  IMAGE_PROVIDER: z.enum(['stability', 'openai', 'replicate', 'local_sd']).default('stability'),
  STABILITY_API_KEY: z.string().optional(),
  VIDEO_GEN_PROVIDER: z.enum(['runway', 'pika', 'replicate', 'disabled']).default('disabled'),

  // OAuth providers
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().optional(),
  TIKTOK_OAUTH_CLIENT_KEY: z.string().optional(),
  TIKTOK_OAUTH_CLIENT_SECRET: z.string().optional(),

  // Internal
  INTERNAL_SERVICE_TOKEN: z.string().min(16),

  // Rate limits & quotas (env defaults; per-plan overrides live in DB)
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_API_PER_MINUTE: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AI_PER_MINUTE: z.coerce.number().int().positive().default(20),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5_368_709_120),

  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  PROMETHEUS_METRICS_PORT: z.coerce.number().int().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
