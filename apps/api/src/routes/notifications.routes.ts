import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../config/db';
import { requireAuth } from '../middleware/auth';

const idParams = z.object({ id: z.string() });

// `z.coerce.boolean()` turns the string "false" into true — parse explicitly.
// Accepts booleans as well: fastify's zod provider stores the TRANSFORMED
// value back on req.query, and the handler re-parses the same schema — a
// string-only enum would reject its own output on that second pass.
const queryBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unreadOnly: queryBool,
});

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/notifications', {
    schema: {
      tags: ['notifications'],
      querystring: listQuerySchema,
    },
    handler: async (req) => {
      const q = listQuerySchema.parse(req.query);
      const rows = await prisma.notification.findMany({
        where: { userId: req.auth!.sub, ...(q.unreadOnly ? { readAt: null } : {}) },
        take: q.limit + 1,
        orderBy: { createdAt: 'desc' },
        ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
      });
      let nextCursor: string | null = null;
      if (rows.length > q.limit) {
        nextCursor = rows[q.limit - 1]?.id ?? null;
        rows.pop();
      }
      const unreadCount = await prisma.notification.count({
        where: { userId: req.auth!.sub, readAt: null },
      });
      return {
        items: rows.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor,
        unreadCount,
      };
    },
  });

  app.post('/notifications/read', {
    schema: {
      tags: ['notifications'],
      body: z.object({ ids: z.array(z.string()).min(1).max(200) }),
    },
    handler: async (req) => {
      const body = z.object({ ids: z.array(z.string()).min(1).max(200) }).parse(req.body);
      await prisma.notification.updateMany({
        where: { userId: req.auth!.sub, id: { in: body.ids }, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true as const };
    },
  });

  app.post('/notifications/read-all', {
    schema: { tags: ['notifications'] },
    handler: async (req) => {
      await prisma.notification.updateMany({
        where: { userId: req.auth!.sub, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true as const };
    },
  });

  app.delete('/notifications/:id', {
    schema: { tags: ['notifications'], params: idParams },
    handler: async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await prisma.notification.deleteMany({
        where: { id, userId: req.auth!.sub },
      });
      reply.code(204).send();
    },
  });
}
