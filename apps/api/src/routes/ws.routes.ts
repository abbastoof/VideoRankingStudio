import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../config/db';
import { getRedisPubSub } from '../config/redis';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../lib/jwt';
import { env } from '../config/env';

/**
 * WebSocket endpoint for streaming job progress to the editor.
 *
 *   ws://api/v1/ws/projects/:id
 *
 * Authentication: the session cookie is forwarded by the browser, so we
 * verify it before upgrading. The connection joins a Redis pubsub pattern
 * for all jobs belonging to the project. Worker tasks publish to
 * `vrs:job:{jobId}` — we filter to the current project here.
 */

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws/projects/:id', { websocket: true }, async (connection, req) => {
    const { id: projectId } = z.object({ id: z.string() }).parse(req.params);

    const token = (req.cookies as Record<string, string | undefined>)?.[env.SESSION_COOKIE_NAME];
    if (!token) {
      connection.socket.close(4401, 'Unauthorized');
      return;
    }
    let userId: string;
    try {
      const payload = await verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      connection.socket.close(4401, 'Invalid token');
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      connection.socket.close(4404, 'Project not found');
      return;
    }

    const sub = getRedisPubSub().duplicate();
    await sub.psubscribe('vrs:job:*');

    const jobsOnThisProject = new Set<string>();
    const recentJobs = await prisma.aiJob.findMany({
      where: { projectId, status: { in: ['QUEUED', 'RUNNING', 'RETRYING'] } },
      select: { id: true },
    });
    recentJobs.forEach((j) => jobsOnThisProject.add(j.id));

    sub.on('pmessage', async (_pattern, channel, message) => {
      const jobId = channel.split(':').pop();
      if (!jobId) return;
      if (!jobsOnThisProject.has(jobId)) {
        const job = await prisma.aiJob.findFirst({
          where: { id: jobId, projectId },
          select: { id: true },
        });
        if (!job) return;
        jobsOnThisProject.add(jobId);
      }
      if (connection.socket.readyState === connection.socket.OPEN) {
        connection.socket.send(message);
      }
    });

    connection.socket.on('close', () => {
      void sub.quit();
    });
    connection.socket.on('error', (err: unknown) => logger.warn({ err }, 'ws.error'));

    connection.socket.send(JSON.stringify({ type: 'hello', projectId }));
  });
}
