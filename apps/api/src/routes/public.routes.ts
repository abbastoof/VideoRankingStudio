import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env } from '../config/env';
import { prisma } from '../config/db';
import { getRedis } from '../config/redis';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';
import { sendContactMessage } from '../services/contact.service';

/**
 * Unauthenticated, public-facing endpoints for the marketing site.
 *
 * Everything under this file must be safe to call without a session — that
 * means aggressive per-IP rate limits, small max-body sizes, and no exposure
 * of internals beyond what a curious visitor could already see.
 */

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  topic: z.enum(['general', 'sales', 'support', 'press', 'security']).default('general'),
  message: z.string().trim().min(10).max(5_000),
  // Honeypot. Real users leave it blank; naive bots fill it in.
  website: z.string().max(500).optional(),
});

const statusResponseSchema = z.object({
  status: z.enum(['operational', 'degraded', 'down']),
  updatedAt: z.string(),
  components: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      status: z.enum(['operational', 'degraded', 'down']),
      latencyMs: z.number().optional(),
    }),
  ),
});

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // Contact form. Tight per-IP limit; message payload is capped at 5k so the
  // endpoint can't be used as a mail-relay firehose.
  app.post('/public/contact', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: { tags: ['public'], body: contactSchema },
    handler: async (req, reply) => {
      const body = contactSchema.parse(req.body);

      // Honeypot short-circuit: pretend success without doing anything. Real
      // users won't notice; bots won't get useful signal that they were caught.
      if (body.website && body.website.trim().length > 0) {
        logger.info({ ip: req.ip }, 'contact.honeypot_tripped');
        reply.code(202);
        return { ok: true as const };
      }

      try {
        await sendContactMessage({
          name: body.name,
          email: body.email,
          topic: body.topic,
          message: body.message,
          ip: req.ip,
          userAgent: req.headers['user-agent']?.slice(0, 500),
        });
      } catch (err) {
        logger.error({ err }, 'contact.send_failed');
        throw Errors.internal('Could not send your message right now. Please try again shortly.');
      }

      reply.code(202);
      return { ok: true as const };
    },
  });

  // Component-level status snapshot for the public /status page. This is
  // intentionally coarser than /health/ready — it exposes only what
  // externally-visible callers already infer from behavior.
  app.get('/public/status', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: { tags: ['public'], response: { 200: statusResponseSchema } },
    handler: async () => {
      const components: Array<{
        key: string;
        label: string;
        status: 'operational' | 'degraded' | 'down';
        latencyMs?: number;
      }> = [];

      // API is up if this handler runs.
      components.push({ key: 'api', label: 'API', status: 'operational' });

      // Database
      try {
        const t = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        components.push({ key: 'database', label: 'Database', status: 'operational', latencyMs: Date.now() - t });
      } catch {
        components.push({ key: 'database', label: 'Database', status: 'down' });
      }

      // Redis
      try {
        const t = Date.now();
        await getRedis().ping();
        components.push({ key: 'redis', label: 'Cache / queue', status: 'operational', latencyMs: Date.now() - t });
      } catch {
        components.push({ key: 'redis', label: 'Cache / queue', status: 'down' });
      }

      // Roll up: any 'down' → down; any 'degraded' → degraded; else operational.
      const overall = components.some((c) => c.status === 'down')
        ? 'down'
        : components.some((c) => c.status === 'degraded')
          ? 'degraded'
          : 'operational';

      return {
        status: overall,
        updatedAt: new Date().toISOString(),
        components,
      };
    },
  });

  // Version marker — cheap to hit from the marketing site if we ever want to
  // surface the build SHA.
  app.get('/public/version', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: { tags: ['public'] },
    handler: async () => ({
      version: '0.1.0',
      commit: process.env.GIT_SHA ?? 'dev',
      environment: env.NODE_ENV,
    }),
  });
}
