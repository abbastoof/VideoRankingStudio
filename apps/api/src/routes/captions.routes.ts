import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import * as captions from '../services/captions.service';

const projectParams = z.object({ id: z.string() });
const transcriptParams = z.object({ id: z.string(), transcriptId: z.string() });
const segmentParams = z.object({ id: z.string(), transcriptId: z.string(), segmentId: z.string() });
const captionParams = z.object({ id: z.string(), captionId: z.string() });

const updateSegmentSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().nonnegative().optional(),
  speakerLabel: z.string().nullable().optional(),
});

const insertSegmentSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string().min(1).max(1000),
  speakerLabel: z.string().nullable().optional(),
});

const captionCreateSchema = z.object({
  name: z.string().max(80).optional(),
  transcriptId: z.string().nullable().optional(),
  styleJson: z.record(z.unknown()).optional(),
  segments: z
    .array(z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative(), text: z.string() }))
    .optional(),
});

const captionUpdateSchema = z.object({
  name: z.string().max(80).optional(),
  enabled: z.boolean().optional(),
  styleJson: z.record(z.unknown()).optional(),
  segmentsJson: z
    .array(z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative(), text: z.string() }))
    .optional(),
});

export async function captionsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── Transcripts ─────────────────────────────────────────────────
  app.get('/projects/:id/transcripts', {
    schema: { tags: ['captions'], params: projectParams },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      return captions.listTranscripts(req.auth!.sub, id);
    },
  });

  app.get('/projects/:id/transcripts/:transcriptId', {
    schema: { tags: ['captions'], params: transcriptParams },
    handler: async (req) => {
      const { transcriptId } = transcriptParams.parse(req.params);
      return captions.getTranscript(req.auth!.sub, transcriptId);
    },
  });

  app.patch('/projects/:id/transcripts/:transcriptId/segments/:segmentId', {
    schema: { tags: ['captions'], params: segmentParams, body: updateSegmentSchema },
    handler: async (req) => {
      const { transcriptId, segmentId } = segmentParams.parse(req.params);
      const body = updateSegmentSchema.parse(req.body);
      return captions.updateSegment(req.auth!.sub, transcriptId, segmentId, body);
    },
  });

  app.post('/projects/:id/transcripts/:transcriptId/segments', {
    schema: { tags: ['captions'], params: transcriptParams, body: insertSegmentSchema },
    handler: async (req, reply) => {
      const { transcriptId } = transcriptParams.parse(req.params);
      const body = insertSegmentSchema.parse(req.body);
      reply.code(201);
      return captions.insertSegment(req.auth!.sub, transcriptId, body);
    },
  });

  app.delete('/projects/:id/transcripts/:transcriptId/segments/:segmentId', {
    schema: { tags: ['captions'], params: segmentParams },
    handler: async (req, reply) => {
      const { transcriptId, segmentId } = segmentParams.parse(req.params);
      await captions.removeSegment(req.auth!.sub, transcriptId, segmentId);
      reply.code(204).send();
    },
  });

  // ─── Caption tracks ──────────────────────────────────────────────
  app.get('/projects/:id/captions', {
    schema: { tags: ['captions'], params: projectParams },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      return { items: await captions.listCaptions(req.auth!.sub, id), nextCursor: null };
    },
  });

  app.post('/projects/:id/captions', {
    schema: { tags: ['captions'], params: projectParams, body: captionCreateSchema },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = captionCreateSchema.parse(req.body);
      reply.code(201);
      return captions.createCaption(req.auth!.sub, id, body);
    },
  });

  app.patch('/projects/:id/captions/:captionId', {
    schema: { tags: ['captions'], params: captionParams, body: captionUpdateSchema },
    handler: async (req) => {
      const { id, captionId } = captionParams.parse(req.params);
      const body = captionUpdateSchema.parse(req.body);
      return captions.updateCaption(req.auth!.sub, id, captionId, body);
    },
  });

  app.delete('/projects/:id/captions/:captionId', {
    schema: { tags: ['captions'], params: captionParams },
    handler: async (req, reply) => {
      const { id, captionId } = captionParams.parse(req.params);
      await captions.deleteCaption(req.auth!.sub, id, captionId);
      reply.code(204).send();
    },
  });
}
