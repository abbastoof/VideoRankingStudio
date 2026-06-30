import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assetSchema, pageOf } from '@vrs/types';

import { requireAuth } from '../middleware/auth';
import * as assets from '../services/assets.service';

export async function assetsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/assets', {
    schema: {
      tags: ['assets'],
      querystring: z.object({
        projectId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      response: { 200: pageOf(assetSchema) },
    },
    handler: async (req) => {
      const q = z
        .object({
          projectId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .parse(req.query);
      return assets.listAssets(req.auth!.sub, q);
    },
  });

  app.get('/assets/:id', {
    schema: {
      tags: ['assets'],
      params: z.object({ id: z.string() }),
      response: { 200: assetSchema },
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      return assets.getAsset(req.auth!.sub, id);
    },
  });
}
