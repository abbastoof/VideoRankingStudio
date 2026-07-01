import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../config/db';
import { env } from '../config/env';

/**
 * Test-only helpers. Only registered when NODE_ENV=test.
 *
 * These endpoints let the E2E harness plant known OTP codes so we can sign
 * in without scraping Mailhog. They must never be reachable in production.
 */

export async function testRoutes(app: FastifyInstance): Promise<void> {
  if (env.NODE_ENV !== 'test') return;

  const plantSchema = z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{4,8}$/),
    purpose: z.enum(['SIGN_IN', 'SIGN_UP']).default('SIGN_IN'),
  });

  app.post('/_test/plant-otp', {
    schema: { tags: ['_test'], body: plantSchema },
    handler: async (req) => {
      const body = plantSchema.parse(req.body);
      const argon2 = (await import('argon2')).default;
      const codeHash = await argon2.hash(body.code, { type: argon2.argon2id });

      // Ensure a fresh, valid row exists — override any live OTP for that email.
      await prisma.otpCode.updateMany({
        where: { email: body.email.toLowerCase(), purpose: body.purpose, consumedAt: null },
        data: { expiresAt: new Date() },
      });
      await prisma.otpCode.create({
        data: {
          email: body.email.toLowerCase(),
          purpose: body.purpose,
          codeHash,
          expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
        },
      });
      return { ok: true as const };
    },
  });

  app.post('/_test/reset', {
    handler: async () => {
      // Wipe user-generated tables so a test suite starts from a clean slate.
      const tables = [
        'AuditLog',
        'Notification',
        'AiJob',
        'Voiceover',
        'Voice',
        'Caption',
        'TranscriptSegment',
        'Transcript',
        'Clip',
        'Track',
        'Asset',
        'Project',
        'OtpCode',
        'Session',
        'Account',
        'User',
      ];
      await prisma.$transaction(
        tables.map((t) =>
          prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`),
        ),
      );
      return { ok: true as const };
    },
  });
}
