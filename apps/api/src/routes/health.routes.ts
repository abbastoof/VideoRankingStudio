import type { FastifyInstance } from 'fastify';

import { prisma } from '../config/db';
import { getRedis } from '../config/redis';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', service: 'api' }));

  app.get('/health/ready', async (_req, reply) => {
    const checks: Record<string, { status: 'ok' | 'fail'; latencyMs?: number }> = {};
    let overall: 'ok' | 'degraded' | 'down' = 'ok';

    // DB
    try {
      const t = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - t };
    } catch {
      checks.database = { status: 'fail' };
      overall = 'down';
    }

    // Redis
    try {
      const t = Date.now();
      await getRedis().ping();
      checks.redis = { status: 'ok', latencyMs: Date.now() - t };
    } catch {
      checks.redis = { status: 'fail' };
      overall = overall === 'down' ? 'down' : 'degraded';
    }

    await reply.code(overall === 'down' ? 503 : 200).send({
      status: overall,
      version: process.env.GIT_SHA ?? 'dev',
      uptime: process.uptime(),
      checks,
    });
  });
}
