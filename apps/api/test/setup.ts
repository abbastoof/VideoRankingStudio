import { vi } from 'vitest';

// Force test-safe environment for every module read.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.WEB_URL ??= 'http://localhost:3000';
process.env.API_URL ??= 'http://localhost:4000';
process.env.DATABASE_URL ??= 'postgresql://vrs:vrs@localhost:5432/vrs_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379/9';
process.env.S3_ACCESS_KEY_ID ??= 'minioadmin';
process.env.S3_SECRET_ACCESS_KEY ??= 'minioadmin';
process.env.S3_BUCKET_UPLOADS ??= 'vrs-uploads';
process.env.S3_BUCKET_GENERATED ??= 'vrs-generated';
process.env.S3_BUCKET_EXPORTS ??= 'vrs-exports';
process.env.S3_BUCKET_PUBLIC ??= 'vrs-public';
process.env.EMAIL_FROM_ADDRESS ??= 'test@vrs.local';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-plenty-long-32b';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-plenty-long-32';
process.env.INTERNAL_SERVICE_TOKEN ??= 'test-internal-service-token';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test' }),
      verify: vi.fn().mockResolvedValue(true),
    }),
  },
}));
