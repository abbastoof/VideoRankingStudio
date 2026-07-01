import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../config/db';
import { requireAuth } from '../middleware/auth';

/**
 * Personal analytics for the signed-in user.
 * Aggregates come straight from the primary DB; if this becomes hot we move
 * to a materialised-view refresh cadence.
 */
export async function insightsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/insights/overview', {
    schema: {
      tags: ['insights'],
      querystring: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }),
    },
    handler: async (req) => {
      const q = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
      const since = new Date(Date.now() - q.days * 24 * 3600 * 1000);
      const userId = req.auth!.sub;

      const [projectCount, exportCount, aiJobsByKind, exportsByDay, topProjects, avgExportSeconds] =
        await Promise.all([
          prisma.project.count({ where: { userId, deletedAt: null, createdAt: { gte: since } } }),
          prisma.export.count({ where: { userId, createdAt: { gte: since } } }),
          prisma.$queryRaw<Array<{ kind: string; count: number }>>`
            SELECT kind::text AS kind, COUNT(*)::int AS count
            FROM "AiJob"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY kind
            ORDER BY count DESC
          `,
          prisma.$queryRaw<Array<{ day: string; count: number }>>`
            SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
            FROM "Export"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
          prisma.$queryRaw<Array<{ id: string; title: string; exports: number }>>`
            SELECT p.id, p.title, COUNT(e.id)::int AS exports
            FROM "Project" p
            LEFT JOIN "Export" e ON e."projectId" = p.id AND e."createdAt" >= ${since}
            WHERE p."userId" = ${userId} AND p."deletedAt" IS NULL
            GROUP BY p.id, p.title
            ORDER BY exports DESC, p."lastEditedAt" DESC
            LIMIT 10
          `,
          prisma.$queryRaw<Array<{ avg_seconds: number | null }>>`
            SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")))::float AS avg_seconds
            FROM "Export"
            WHERE "userId" = ${userId} AND "status" = 'COMPLETED' AND "createdAt" >= ${since}
          `,
        ]);

      return {
        rangeDays: q.days,
        projectCount,
        exportCount,
        avgExportSeconds: avgExportSeconds[0]?.avg_seconds ?? 0,
        aiJobsByKind,
        exportsByDay,
        topProjects,
      };
    },
  });
}
