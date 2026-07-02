import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../config/db';
import { env } from '../config/env';

/**
 * Test-only helpers. Only registered when NODE_ENV=test AND the caller
 * comes from a private/loopback address.
 *
 * These endpoints let the E2E harness plant known OTP codes and truncate
 * tables so we can sign in without scraping Mailhog and start each suite
 * from a clean slate. The extra loopback gate is a belt-and-braces measure
 * against a misconfigured production being flipped to NODE_ENV=test — the
 * `_test/reset` endpoint is destructive and unauthenticated by design.
 */

function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
}

export async function testRoutes(app: FastifyInstance): Promise<void> {
  if (env.NODE_ENV !== 'test') return;

  app.addHook('preHandler', async (req) => {
    if (!isLoopback(req.ip)) {
      // Return the standard 404 instead of a hint that these routes exist.
      throw app.httpErrors.notFound();
    }
  });

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
