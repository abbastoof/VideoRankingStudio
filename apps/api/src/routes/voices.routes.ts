import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pageOf, voiceSchema } from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { presignGet } from '../services/storage.service';

export async function voicesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/voices', {
    schema: {
      tags: ['voices'],
      querystring: z.object({
        kind: z.enum(['STOCK', 'CLONED']).optional(),
        language: z.string().optional(),
      }),
      response: { 200: pageOf(voiceSchema) },
    },
    handler: async (req) => {
      const q = z
        .object({
          kind: z.enum(['STOCK', 'CLONED']).optional(),
          language: z.string().optional(),
        })
        .parse(req.query);
      const voices = await prisma.voice.findMany({
        where: {
          disabledAt: null,
          OR: [{ userId: req.auth!.sub }, { userId: null }],
          ...(q.kind ? { kind: q.kind } : {}),
          ...(q.language ? { language: q.language } : {}),
        },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      });
      const items = await Promise.all(
        voices.map(async (v) => ({
          id: v.id,
          kind: v.kind,
          name: v.name,
          description: v.description,
          provider: v.provider,
          status: v.status,
          language: v.language,
          gender: v.gender,
          ageGroup: v.ageGroup,
          previewUrl: v.previewKey
            ? await presignGet({ bucket: 'public', key: v.previewKey, expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS })
            : null,
          trainingProgress: v.trainingProgress,
          charactersUsed: v.charactersUsed,
          createdAt: v.createdAt.toISOString(),
        })),
      );
      return { items, nextCursor: null };
    },
  });

  const cloneVoiceSchema = z.object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).optional(),
    consentSignedAt: z.string().datetime(),
    sampleAssetIds: z.array(z.string()).min(1).max(20),
  });

  app.post('/voices/clone', {
    schema: {
      tags: ['voices'],
      body: cloneVoiceSchema,
    },
    handler: async (req, reply) => {
      const body = cloneVoiceSchema.parse(req.body);
      const voice = await prisma.voice.create({
        data: {
          userId: req.auth!.sub,
          kind: 'CLONED',
          name: body.name,
          description: body.description ?? null,
          provider: 'ELEVENLABS',
          providerVoiceId: `pending-${Date.now()}`,
          status: 'TRAINING',
          consentSignedAt: new Date(body.consentSignedAt),
          trainingProgress: 0,
        },
      });
      const { enqueue } = await import('../services/jobs.service');
      const job = await enqueue({
        userId: req.auth!.sub,
        kind: 'VOICE_CLONE_TRAIN',
        taskName: 'vrs.voice.clone',
        payload: {
          voice_id: voice.id,
          sample_asset_ids: body.sampleAssetIds,
          voice_name: body.name,
        },
      });
      await prisma.voice.update({ where: { id: voice.id }, data: { trainingJobId: job.id } });
      reply.code(202);
      return { voiceId: voice.id, jobId: job.id };
    },
  });

  app.delete('/voices/:id', {
    schema: { tags: ['voices'], params: z.object({ id: z.string() }) },
    handler: async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      await prisma.voice.updateMany({
        where: { id, userId: req.auth!.sub },
        data: { disabledAt: new Date() },
      });
      reply.code(204).send();
    },
  });
}
