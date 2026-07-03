import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Prisma } from '@vrs/db';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { requireInternal } from '../middleware/auth';
import * as projectsRepo from '../repositories/projects.repo';

/**
 * Internal routes are called only by the worker pool (or future cron jobs).
 * Authentication is a shared static token (`INTERNAL_SERVICE_TOKEN`) rather
 * than a JWT — workers run in our own VPC and the token never leaves there.
 *
 * Surface:
 *   PATCH /v1/internal/jobs/:id              — workers report progress + result
 *   GET   /v1/internal/projects/:id/timeline — export worker fetches timeline
 *   POST  /v1/internal/transcripts           — transcription worker writes result
 *   POST  /v1/internal/voiceovers/:id/done   — TTS worker reports finished file
 *   POST  /v1/internal/assets/:id/done       — import worker registers asset
 *   POST  /v1/internal/exports/:id/done      — export worker reports finished render
 */

const jobUpdateSchema = z.object({
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'RETRYING']),
  progress: z.number().min(0).max(1).optional(),
  resultJson: z.record(z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export async function internalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireInternal);

  app.patch('/internal/jobs/:id', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: jobUpdateSchema,
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = jobUpdateSchema.parse(req.body);

      const job = await prisma.aiJob.findUnique({ where: { id } });
      if (!job) throw Errors.notFound('Job');

      const updates: Record<string, unknown> = { status: body.status };
      if (body.progress !== undefined) {
        updates.resultJson = body.resultJson ?? job.resultJson ?? undefined;
      }
      if (body.resultJson !== undefined) updates.resultJson = body.resultJson;
      if (body.errorMessage !== undefined) {
        updates.errorJson = { message: body.errorMessage };
      }
      if (body.status === 'RUNNING' && !job.startedAt) {
        updates.startedAt = new Date();
      }
      if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(body.status)) {
        updates.finishedAt = new Date();
      }
      if (body.status === 'RETRYING') {
        updates.attempts = job.attempts + 1;
      }

      await prisma.aiJob.update({ where: { id }, data: updates });
      return { ok: true };
    },
  });

  app.get('/internal/projects/:id/timeline', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const project = await projectsRepo.findProjectWithTimeline(id);
      if (!project) throw Errors.projectNotFound();

      return {
        id: project.id,
        title: project.title,
        aspectRatio: project.aspectRatio,
        durationMs: project.durationMs,
        tracks: project.tracks.map((t) => ({
          id: t.id,
          kind: t.kind,
          index: t.index,
          muted: t.muted,
          locked: t.locked,
          volume: t.volume,
          clips: t.clips.map((c) => ({
            id: c.id,
            source: c.source,
            startMs: c.startMs,
            durationMs: c.durationMs,
            inMs: c.inMs,
            outMs: c.outMs,
            speed: c.speed,
            volume: c.volume,
            opacity: c.opacity,
            transformJson: c.transformJson,
            effectsJson: c.effectsJson,
            textJson: c.textJson,
            isHighlight: c.isHighlight,
            asset: c.asset
              ? {
                  id: c.asset.id,
                  kind: c.asset.kind,
                  s3Bucket: c.asset.s3Bucket,
                  s3Key: c.asset.s3Key,
                  mimeType: c.asset.mimeType,
                  durationMs: c.asset.durationMs,
                  width: c.asset.width,
                  height: c.asset.height,
                }
              : null,
            voiceover: c.voiceover
              ? {
                  id: c.voiceover.id,
                  audioBucket: c.voiceover.audioBucket,
                  audioKey: c.voiceover.audioKey,
                  durationMs: c.voiceover.durationMs,
                }
              : null,
          })),
        })),
        captions: project.captions.map((c) => ({
          id: c.id,
          name: c.name,
          enabled: c.enabled,
          styleJson: c.styleJson,
          segmentsJson: c.segmentsJson,
        })),
      };
    },
  });

  const assetDoneSchema = z.object({
    s3Bucket: z.string(),
    s3Key: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    durationMs: z.number().int().nullable().optional(),
    width: z.number().int().nullable().optional(),
    height: z.number().int().nullable().optional(),
    fps: z.number().nullable().optional(),
  });

  app.post('/internal/assets/:id/done', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: assetDoneSchema,
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = assetDoneSchema.parse(req.body);
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          status: 'READY',
          s3Bucket: body.s3Bucket,
          s3Key: body.s3Key,
          mimeType: body.mimeType,
          sizeBytes: BigInt(body.sizeBytes),
          durationMs: body.durationMs ?? null,
          width: body.width ?? null,
          height: body.height ?? null,
          fps: body.fps ?? null,
        },
      });
      return { ok: true, assetId: asset.id };
    },
  });

  const transcriptDoneSchema = z.object({
    transcriptId: z.string(),
    language: z.string(),
    durationMs: z.number().int().nonnegative(),
    srtKey: z.string().optional(),
    vttKey: z.string().optional(),
    text: z.string(),
    segments: z.array(
      z.object({
        index: z.number().int().nonnegative(),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        text: z.string(),
        speakerLabel: z.string().nullable().optional(),
        confidence: z.number().nullable().optional(),
        words: z.array(z.record(z.unknown())).optional(),
      }),
    ),
  });

  app.post('/internal/transcripts/done', {
    schema: { tags: ['internal'], body: transcriptDoneSchema },
    handler: async (req) => {
      const body = transcriptDoneSchema.parse(req.body);
      await prisma.$transaction(async (tx) => {
        await tx.transcript.update({
          where: { id: body.transcriptId },
          data: {
            status: 'COMPLETED',
            language: body.language,
            durationMs: body.durationMs,
            srtKey: body.srtKey ?? null,
            vttKey: body.vttKey ?? null,
            contentText: body.text,
          },
        });
        // Replace segments wholesale.
        await tx.transcriptSegment.deleteMany({ where: { transcriptId: body.transcriptId } });
        await tx.transcriptSegment.createMany({
          data: body.segments.map((s) => ({
            transcriptId: body.transcriptId,
            index: s.index,
            startMs: s.startMs,
            endMs: s.endMs,
            text: s.text,
            speakerLabel: s.speakerLabel ?? null,
            confidence: s.confidence ?? null,
            wordsJson: (s.words ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        });
      });
      return { ok: true };
    },
  });

  const voiceoverDoneSchema = z.object({
    audioBucket: z.string(),
    audioKey: z.string(),
    durationMs: z.number().int().nonnegative().optional(),
    charactersUsed: z.number().int().nonnegative(),
  });

  app.post('/internal/voiceovers/:id/done', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: voiceoverDoneSchema,
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = voiceoverDoneSchema.parse(req.body);
      const vo = await prisma.voiceover.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          audioBucket: body.audioBucket,
          audioKey: body.audioKey,
          durationMs: body.durationMs ?? null,
          charactersUsed: body.charactersUsed,
        },
      });
      return { ok: true, voiceoverId: vo.id };
    },
  });

  const exportDoneSchema = z.object({
    s3Bucket: z.string(),
    s3Key: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    durationMs: z.number().int().nullable().optional(),
  });

  // Asset lookup for internal workers (voice-clone, etc.)
  app.get('/internal/assets/:id', {
    schema: { tags: ['internal'], params: z.object({ id: z.string() }) },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const a = await prisma.asset.findUnique({ where: { id } });
      if (!a) throw Errors.notFound('Asset');
      return {
        id: a.id,
        s3Bucket: a.s3Bucket,
        s3Key: a.s3Key,
        kind: a.kind,
        mimeType: a.mimeType,
      };
    },
  });

  // Voice-clone completion callback
  app.post('/internal/voices/:id/trained', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: z.object({
        provider: z.enum(['ELEVENLABS', 'AZURE', 'POLLY', 'COQUI', 'PLAYHT', 'INTERNAL']),
        providerVoiceId: z.string(),
      }),
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = z
        .object({
          provider: z.enum(['ELEVENLABS', 'AZURE', 'POLLY', 'COQUI', 'PLAYHT', 'INTERNAL']),
          providerVoiceId: z.string(),
        })
        .parse(req.body);
      await prisma.voice.update({
        where: { id },
        data: {
          status: 'READY',
          provider: body.provider,
          providerVoiceId: body.providerVoiceId,
          trainingProgress: 1,
        },
      });
      return { ok: true };
    },
  });

  app.post('/internal/exports/:id/done', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: exportDoneSchema,
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = exportDoneSchema.parse(req.body);
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const ex = await prisma.export.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          progress: 1,
          s3Bucket: body.s3Bucket,
          s3Key: body.s3Key,
          sizeBytes: BigInt(body.sizeBytes),
          durationMs: body.durationMs ?? null,
          completedAt: new Date(),
          expiresAt,
        },
        include: { project: { select: { title: true } } },
      });
      const { notify } = await import('../services/notifications.service');
      notify({
        userId: ex.userId,
        kind: 'EXPORT_READY',
        title: `"${ex.project.title}" is ready`,
        body: 'Your export finished rendering. Download or publish it now.',
        link: `/projects/${ex.projectId}/exports/${ex.id}`,
      });
      await prisma.user.update({
        where: { id: ex.userId },
        data: { exportsCount: { increment: 1 } },
      });
      return { ok: true, exportId: ex.id };
    },
  });

  app.post('/internal/exports/:id/failed', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: z.object({ errorMessage: z.string() }),
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = z.object({ errorMessage: z.string() }).parse(req.body);
      const ex = await prisma.export.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: body.errorMessage },
        include: { project: { select: { title: true } } },
      });
      const { notify } = await import('../services/notifications.service');
      notify({
        userId: ex.userId,
        kind: 'EXPORT_FAILED',
        title: `Export failed: ${ex.project.title}`,
        body: body.errorMessage,
        link: `/projects/${ex.projectId}/exports/${ex.id}`,
      });
      return { ok: true };
    },
  });

  // Publish target token access (worker retrieves decrypted OAuth tokens)
  app.get('/internal/publish-targets/:id', {
    schema: { tags: ['internal'], params: z.object({ id: z.string() }) },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const { getDecryptedTarget } = await import('../services/publish.service');
      return getDecryptedTarget(id);
    },
  });

  const publishDoneSchema = z.object({
    status: z.enum(['PUBLISHED', 'FAILED']),
    providerVideoId: z.string().nullable().optional(),
    providerUrl: z.string().url().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  });

  app.post('/internal/publish-jobs/:id/done', {
    schema: {
      tags: ['internal'],
      params: z.object({ id: z.string() }),
      body: publishDoneSchema,
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = publishDoneSchema.parse(req.body);
      const row = await prisma.publishJob.update({
        where: { id },
        data: {
          status: body.status,
          providerVideoId: body.providerVideoId ?? null,
          providerUrl: body.providerUrl ?? null,
          errorMessage: body.errorMessage ?? null,
          publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
        },
        include: {
          export: { select: { userId: true } },
          target: { select: { provider: true } },
        },
      });
      const { notify } = await import('../services/notifications.service');
      const isSuccess = body.status === 'PUBLISHED';
      notify({
        userId: row.export.userId,
        kind: isSuccess ? 'SYSTEM_ANNOUNCEMENT' : 'SYSTEM_ANNOUNCEMENT',
        title: isSuccess
          ? `Published to ${row.target.provider.toLowerCase()}`
          : `Publish to ${row.target.provider.toLowerCase()} failed`,
        body: isSuccess
          ? 'Your video is live. Tap to open it.'
          : body.errorMessage ?? 'The platform rejected the upload.',
        link: body.providerUrl ?? '/publish/history',
      });
      return { ok: true, publishJobId: row.id };
    },
  });
}
