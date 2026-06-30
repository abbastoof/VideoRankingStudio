import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pageOf, templateListQuerySchema, templateSchema } from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { presignGet } from '../services/storage.service';

export async function templatesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/templates', {
    schema: {
      tags: ['templates'],
      querystring: templateListQuerySchema,
      response: { 200: pageOf(templateSchema) },
    },
    handler: async (req) => {
      const q = templateListQuerySchema.parse(req.query);
      const orderBy =
        q.sortBy === 'popularity'
          ? [{ popularity: 'desc' as const }, { createdAt: 'desc' as const }]
          : [{ createdAt: 'desc' as const }];

      const items = await prisma.template.findMany({
        where: {
          publishedAt: { not: null },
          ...(q.category ? { category: q.category } : {}),
        },
        orderBy,
        take: q.limit + 1,
        ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
      });

      let nextCursor: string | null = null;
      if (items.length > q.limit) {
        nextCursor = items[q.limit - 1]?.id ?? null;
        items.pop();
      }

      const serialized = await Promise.all(
        items.map(async (t) => ({
          id: t.id,
          slug: t.slug,
          title: t.title,
          description: t.description,
          category: t.category,
          thumbnailUrl: t.thumbnailKey
            ? await presignGet({ bucket: 'public', key: t.thumbnailKey, expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS })
            : null,
          previewUrl: t.previewKey
            ? await presignGet({ bucket: 'public', key: t.previewKey })
            : null,
          requiredPlan: t.requiredPlan,
          popularity: t.popularity,
          createdAt: t.createdAt.toISOString(),
        })),
      );

      return { items: serialized, nextCursor };
    },
  });

  app.get('/templates/:slug', {
    schema: {
      tags: ['templates'],
      params: z.object({ slug: z.string() }),
      response: { 200: templateSchema.extend({ blueprintJson: z.record(z.unknown()) }) },
    },
    handler: async (req) => {
      const { slug } = z.object({ slug: z.string() }).parse(req.params);
      const t = await prisma.template.findUnique({ where: { slug } });
      if (!t || !t.publishedAt) throw Errors.notFound('Template');
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        thumbnailUrl: t.thumbnailKey
          ? await presignGet({ bucket: 'public', key: t.thumbnailKey })
          : null,
        previewUrl: t.previewKey ? await presignGet({ bucket: 'public', key: t.previewKey }) : null,
        requiredPlan: t.requiredPlan,
        popularity: t.popularity,
        createdAt: t.createdAt.toISOString(),
        blueprintJson: t.blueprintJson as Record<string, unknown>,
      };
    },
  });
}
