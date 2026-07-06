import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import * as ranking from '../services/ranking.service';

const projectParams = z.object({ id: z.string() });
const candidateParams = z.object({ id: z.string(), candidateId: z.string() });

const candidateSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullable().optional(),
  score: z.number(),
  assetId: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  trimStartMs: z.number().int().nonnegative().nullable().optional(),
  trimEndMs: z.number().int().positive().nullable().optional(),
  volume: z.number().min(0).max(2).optional(),
  metadataJson: z.record(z.unknown()).optional(),
});

const updateCandidateSchema = candidateSchema.partial();

const titleStyleSchema = z.object({
  fontFamily: z.string().max(64).optional(),
  fontSize: z.number().min(8).max(240).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: z.string().max(32).optional(),
  background: z.string().max(64).nullable().optional(),
  strokeColor: z.string().max(32).optional(),
  strokeWidth: z.number().min(0).max(40).optional(),
  xPct: z.number().min(0).max(100).nullable().optional(),
  yPct: z.number().min(0).max(100).nullable().optional(),
});

const metaSchema = z.object({
  order: z.enum(['asc', 'desc']).optional(),
  orderMode: z.enum(['score', 'custom']).optional(),
  transition: z.enum(['none', 'fade']).optional(),
  headerText: z.string().max(200).nullable().optional(),
  brandColor: z.string().max(32).nullable().optional(),
  reveal: z.enum(['countdown', 'topfirst']).optional(),
  titleStyle: titleStyleSchema.nullable().optional(),
  backgroundColor: z.string().max(32).nullable().optional(),
  videoHeightPct: z.number().min(10).max(100).nullable().optional(),
  captionsEnabled: z.boolean().optional(),
});

const reorderSchema = z.object({ orderedIds: z.array(z.string()).min(1).max(200) });

const createRankingSchema = z.object({
  title: z.string().min(1).max(160),
  aspectRatio: z.enum(['R9_16', 'R16_9', 'R1_1', 'R4_5']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export async function rankingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/rankings', {
    schema: { tags: ['ranking'], body: createRankingSchema },
    handler: async (req, reply) => {
      const body = createRankingSchema.parse(req.body);
      reply.code(201);
      return ranking.createRankingProject(req.auth!.sub, body);
    },
  });

  app.get('/rankings/:id', {
    schema: { tags: ['ranking'], params: projectParams },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      return ranking.getRanking(req.auth!.sub, id);
    },
  });

  app.patch('/rankings/:id', {
    schema: { tags: ['ranking'], params: projectParams, body: metaSchema },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      const body = metaSchema.parse(req.body);
      await ranking.updateRankingMeta(req.auth!.sub, id, body);
      return ranking.getRanking(req.auth!.sub, id);
    },
  });

  app.post('/rankings/:id/candidates', {
    schema: { tags: ['ranking'], params: projectParams, body: candidateSchema },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = candidateSchema.parse(req.body);
      reply.code(201);
      return ranking.addCandidate(req.auth!.sub, id, body);
    },
  });

  app.patch('/rankings/:id/candidates/:candidateId', {
    schema: { tags: ['ranking'], params: candidateParams, body: updateCandidateSchema },
    handler: async (req) => {
      const { id, candidateId } = candidateParams.parse(req.params);
      const body = updateCandidateSchema.parse(req.body);
      return ranking.updateCandidate(req.auth!.sub, id, candidateId, body);
    },
  });

  app.delete('/rankings/:id/candidates/:candidateId', {
    schema: { tags: ['ranking'], params: candidateParams },
    handler: async (req, reply) => {
      const { id, candidateId } = candidateParams.parse(req.params);
      await ranking.removeCandidate(req.auth!.sub, id, candidateId);
      reply.code(204).send();
    },
  });

  app.post('/rankings/:id/candidates/reorder', {
    schema: { tags: ['ranking'], params: projectParams, body: reorderSchema },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      const body = reorderSchema.parse(req.body);
      await ranking.reorderCandidates(req.auth!.sub, id, body.orderedIds);
      return { ok: true as const };
    },
  });

  app.post('/rankings/:id/bake', {
    schema: { tags: ['ranking'], params: projectParams },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      await ranking.bakeTimeline(req.auth!.sub, id);
      return { ok: true as const };
    },
  });
}
