import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  aiJobSchema,
  enqueueJobResponseSchema,
  generateHighlightsSchema,
  generateImageSchema,
  generateScriptSchema,
  generateThumbnailSchema,
  generateVideoSchema,
  requestTranscriptionSchema,
  generateVoiceoverSchema,
  requestExportSchema,
  rewriteScriptSchema,
} from '@vrs/types';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import * as gen from '../services/generation.service';
import * as jobsService from '../services/jobs.service';

const projectParams = z.object({ id: z.string() });

export async function generationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/projects/:id/generate/highlights', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateHighlightsSchema,
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateHighlightsSchema.parse(req.body);
      const out = await gen.requestHighlights(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/transcribe', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: requestTranscriptionSchema,
      response: {
        202: z.object({ transcriptId: z.string(), jobId: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = requestTranscriptionSchema.parse(req.body);
      const out = await gen.requestTranscription(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/voice', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateVoiceoverSchema,
      response: {
        202: z.object({ voiceoverId: z.string(), jobId: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateVoiceoverSchema.parse(req.body);
      const out = await gen.requestVoiceover(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/script', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateScriptSchema,
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateScriptSchema.parse(req.body);
      const out = await gen.requestScript(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/rewrite', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: rewriteScriptSchema,
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = rewriteScriptSchema.parse(req.body);
      const out = await gen.requestScriptRewrite(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/image', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateImageSchema,
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateImageSchema.parse(req.body);
      const out = await gen.requestImage(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/video', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateVideoSchema,
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateVideoSchema.parse(req.body);
      const out = await gen.requestVideoGeneration(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/generate/thumbnail', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: generateThumbnailSchema,
      response: {
        202: z.object({ jobId: z.string(), thumbnailKey: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = generateThumbnailSchema.parse(req.body);
      const out = await gen.requestThumbnail(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  app.post('/projects/:id/export', {
    schema: {
      tags: ['generation'],
      params: projectParams,
      body: requestExportSchema,
      response: {
        202: z.object({ exportId: z.string(), jobId: z.string(), title: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = projectParams.parse(req.params);
      const body = requestExportSchema.parse(req.body);
      const out = await gen.requestExport(req.auth!.sub, id, body);
      reply.code(202);
      return out;
    },
  });

  // ─── Job status ────────────────────────────────────────────────────
  app.get('/jobs/:jobId', {
    schema: {
      tags: ['generation'],
      params: z.object({ jobId: z.string() }),
      response: { 200: aiJobSchema },
    },
    handler: async (req) => {
      const { jobId } = z.object({ jobId: z.string() }).parse(req.params);
      return jobsService.getJob(req.auth!.sub, jobId);
    },
  });

  app.post('/jobs/:jobId/cancel', {
    schema: {
      tags: ['generation'],
      params: z.object({ jobId: z.string() }),
      response: { 200: z.object({ ok: z.literal(true) }) },
    },
    handler: async (req) => {
      const { jobId } = z.object({ jobId: z.string() }).parse(req.params);
      await jobsService.cancel(req.auth!.sub, jobId);
      return { ok: true as const };
    },
  });

  app.post('/jobs/:jobId/retry', {
    schema: {
      tags: ['generation'],
      params: z.object({ jobId: z.string() }),
      response: { 202: enqueueJobResponseSchema },
    },
    handler: async (req, reply) => {
      const { jobId } = z.object({ jobId: z.string() }).parse(req.params);
      const existing = await prisma.aiJob.findFirst({
        where: { id: jobId, userId: req.auth!.sub },
      });
      if (!existing) throw Errors.notFound('Job');
      if (existing.status === 'SUCCEEDED') throw Errors.conflict('Job already succeeded');
      const out = await jobsService.retry(existing);
      reply.code(202);
      return { jobId: out.id };
    },
  });

  // ─── Exports listing / detail ─────────────────────────────────────
  app.get('/projects/:id/exports', {
    schema: {
      tags: ['generation'],
      params: projectParams,
    },
    handler: async (req) => {
      const { id } = projectParams.parse(req.params);
      const rows = await prisma.export.findMany({
        where: { projectId: id, userId: req.auth!.sub },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          format: r.format,
          resolutionW: r.resolutionW,
          resolutionH: r.resolutionH,
          fps: r.fps,
          durationMs: r.durationMs,
          sizeBytes: r.sizeBytes ? Number(r.sizeBytes) : null,
          status: r.status,
          progress: r.progress,
          watermark: r.watermark,
          errorMessage: r.errorMessage,
          createdAt: r.createdAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
        })),
        nextCursor: null,
      };
    },
  });

  app.get('/exports/:exportId', {
    schema: {
      tags: ['generation'],
      params: z.object({ exportId: z.string() }),
    },
    handler: async (req) => {
      const { exportId } = z.object({ exportId: z.string() }).parse(req.params);
      const row = await prisma.export.findFirst({
        where: { id: exportId, userId: req.auth!.sub },
      });
      if (!row) throw Errors.notFound('Export');
      const { presignGet } = await import('../services/storage.service');
      let downloadUrl: string | null = null;
      if (row.status === 'COMPLETED' && row.s3Bucket && row.s3Key) {
        downloadUrl = await presignGet({
          bucket: row.s3Bucket as 'exports',
          key: row.s3Key,
          expiresInSeconds: 7 * 24 * 3600,
        });
      }
      return {
        id: row.id,
        projectId: row.projectId,
        format: row.format,
        resolutionW: row.resolutionW,
        resolutionH: row.resolutionH,
        fps: row.fps,
        durationMs: row.durationMs,
        sizeBytes: row.sizeBytes ? Number(row.sizeBytes) : null,
        status: row.status,
        progress: row.progress,
        watermark: row.watermark,
        downloadUrl,
        errorMessage: row.errorMessage,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      };
    },
  });
}
