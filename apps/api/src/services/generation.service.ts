/**
 * AI generation service.
 *
 * Central entry point for anything that produces AI output. Every handler:
 *  1. verifies the caller owns the project,
 *  2. enforces the relevant quota,
 *  3. creates the domain record (Transcript / Voiceover / Export / etc.),
 *  4. enqueues the Celery task with a stable idempotency key,
 *  5. returns the domain record + AiJob for the client to observe via WS.
 */

import { createHash } from 'node:crypto';

import type {
  GenerateHighlights,
  GenerateImageInput,
  GenerateScript,
  GenerateVoiceover,
  RequestExport,
  RequestTranscription,
  RewriteScript,
} from '@vrs/types';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { enqueue } from './jobs.service';
import * as usage from './usage.service';

async function guardProject(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true, aspectRatio: true, title: true },
  });
  if (!p) throw Errors.projectNotFound();
  return p;
}

function idem(userId: string, projectId: string, tag: string, payload: unknown): string {
  return createHash('sha256')
    .update(`${userId}:${projectId}:${tag}:${JSON.stringify(payload)}`)
    .digest('hex')
    .slice(0, 40);
}

// ─── Highlights ─────────────────────────────────────────────────────────

export async function requestHighlights(
  userId: string,
  projectId: string,
  input: GenerateHighlights,
) {
  await guardProject(userId, projectId);
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, userId, status: { in: ['UPLOADED', 'READY'] } },
    select: { id: true, s3Bucket: true, s3Key: true },
  });
  if (!asset) throw Errors.notFound('Asset');

  const job = await enqueue({
    userId,
    projectId,
    kind: 'HIGHLIGHT_DETECTION',
    taskName: 'vrs.highlights.detect',
    payload: {
      asset_bucket: asset.s3Bucket,
      asset_key: asset.s3Key,
      target_duration_ms: input.targetDurationMs,
      max_clips: input.maxClips,
    },
    idempotencyKey: idem(userId, projectId, 'highlights', input),
  });

  return { jobId: job.id };
}

// ─── Transcription ──────────────────────────────────────────────────────

export async function requestTranscription(
  userId: string,
  projectId: string,
  input: RequestTranscription,
) {
  await guardProject(userId, projectId);
  const asset = input.assetId
    ? await prisma.asset.findFirst({
        where: { id: input.assetId, userId },
      })
    : await prisma.asset.findFirst({
        where: { projectId, userId, kind: { in: ['VIDEO', 'AUDIO'] } },
        orderBy: { createdAt: 'desc' },
      });
  if (!asset || !asset.s3Key) throw Errors.notFound('Asset');

  // Atomic reservation. Reserves one minute up-front so the counter reflects
  // the queued job; the worker's transcripts/done callback can top up the
  // final duration once the real length is known. Without this reservation
  // the transcription quota was never enforced — the previous code only
  // asserted and never incremented, so `TRANSCRIPTION_MINUTES` stayed at 0
  // forever regardless of usage.
  await usage.assertAndIncrement(userId, 'TRANSCRIPTION_MINUTES', 1);

  const transcript = await prisma.transcript.create({
    data: {
      projectId,
      assetId: asset.id,
      language: input.language === 'auto' ? 'en' : input.language,
      provider: 'auto',
      status: 'QUEUED',
    },
  });

  const job = await enqueue({
    userId,
    projectId,
    kind: 'TRANSCRIPTION',
    taskName: 'vrs.transcribe',
    payload: {
      transcript_id: transcript.id,
      asset_bucket: asset.s3Bucket,
      asset_key: asset.s3Key,
      language: input.language,
      diarize: input.diarize,
      output_key_prefix: `projects/${projectId}/transcripts/${transcript.id}`,
    },
    idempotencyKey: idem(userId, projectId, 'transcribe', {
      assetId: asset.id,
      language: input.language,
      diarize: input.diarize,
    }),
  });

  await prisma.transcript.update({
    where: { id: transcript.id },
    data: { status: 'RUNNING' },
  });

  return { transcriptId: transcript.id, jobId: job.id };
}

// ─── Voiceover ──────────────────────────────────────────────────────────

export async function requestVoiceover(
  userId: string,
  projectId: string,
  input: GenerateVoiceover,
) {
  await guardProject(userId, projectId);
  const voice = await prisma.voice.findFirst({
    where: {
      id: input.voiceId,
      OR: [{ userId }, { userId: null }],
      status: 'READY',
      disabledAt: null,
    },
  });
  if (!voice) throw Errors.notFound('Voice');

  const chars = input.scriptText.length;
  await usage.assertAndIncrement(userId, 'VOICEOVER_CHARACTERS', chars);

  const voiceover = await prisma.voiceover.create({
    data: {
      projectId,
      voiceId: voice.id,
      scriptText: input.scriptText,
      status: 'QUEUED',
      speed: input.speed,
      pitch: input.pitch,
      stability: input.stability ?? null,
      similarityBoost: input.similarityBoost ?? null,
      styleJson: (input.styleJson as never) ?? {},
      charactersUsed: chars,
    },
  });

  const job = await enqueue({
    userId,
    projectId,
    kind: 'VOICEOVER',
    taskName: 'vrs.tts.generate',
    payload: {
      voiceover_id: voiceover.id,
      voice_provider: voice.provider,
      provider_voice_id: voice.providerVoiceId,
      script_text: input.scriptText,
      output_key_prefix: `projects/${projectId}/voiceovers`,
      speed: input.speed,
      pitch: input.pitch,
      stability: input.stability ?? null,
      similarity_boost: input.similarityBoost ?? null,
      style: input.styleJson ?? null,
    },
    idempotencyKey: idem(userId, projectId, 'tts', {
      voiceId: voice.id,
      script: input.scriptText,
      speed: input.speed,
      pitch: input.pitch,
    }),
  });

  // The reservation happened in assertAndIncrement above — no second bump.
  await prisma.voiceover.update({ where: { id: voiceover.id }, data: { status: 'RUNNING' } });

  return { voiceoverId: voiceover.id, jobId: job.id };
}

// ─── Script ─────────────────────────────────────────────────────────────

export async function requestScript(userId: string, projectId: string, input: GenerateScript) {
  await guardProject(userId, projectId);
  const { assertPromptAllowed } = await import('./moderation.service');
  await assertPromptAllowed(input.topic);
  const job = await enqueue({
    userId,
    projectId,
    kind: 'SCRIPT_GENERATE',
    taskName: 'vrs.script.generate',
    payload: {
      topic: input.topic,
      tone: input.tone,
      duration_ms: input.durationMs,
      fmt: input.format,
      language: input.language,
    },
    idempotencyKey: idem(userId, projectId, 'script', input),
  });
  return { jobId: job.id };
}

export async function requestScriptRewrite(
  userId: string,
  projectId: string,
  input: RewriteScript,
) {
  await guardProject(userId, projectId);
  const { assertPromptAllowed } = await import('./moderation.service');
  await assertPromptAllowed(input.text);
  const job = await enqueue({
    userId,
    projectId,
    kind: 'SCRIPT_REWRITE',
    taskName: 'vrs.script.rewrite',
    payload: {
      text: input.text,
      goal: input.goal,
      target_language: input.targetLanguage ?? null,
    },
    idempotencyKey: idem(userId, projectId, 'rewrite', input),
  });
  return { jobId: job.id };
}

// ─── Image ──────────────────────────────────────────────────────────────

export async function requestImage(userId: string, projectId: string, input: GenerateImageInput) {
  await guardProject(userId, projectId);
  await usage.assertAndIncrement(userId, 'IMAGE_GENERATIONS', input.count);
  const { assertPromptAllowed } = await import('./moderation.service');
  try {
    await assertPromptAllowed(`${input.prompt}\n${input.negativePrompt ?? ''}`);
  } catch (err) {
    // Refund the reservation — a moderation-rejected prompt never actually
    // consumes provider capacity, so it shouldn't consume the user's quota.
    await usage.increment(userId, 'IMAGE_GENERATIONS', -input.count);
    throw err;
  }

  const job = await enqueue({
    userId,
    projectId,
    kind: 'IMAGE_GENERATE',
    taskName: 'vrs.image.generate',
    payload: {
      asset_id_prefix: `img_${Date.now()}`,
      prompt: input.prompt,
      negative_prompt: input.negativePrompt ?? null,
      width: input.width,
      height: input.height,
      count: input.count,
      output_key_prefix: `projects/${projectId}/images`,
    },
    idempotencyKey: idem(userId, projectId, 'image', input),
  });
  return { jobId: job.id };
}

// ─── Video generation (LLM-guided) ──────────────────────────────────────

export async function requestVideoGeneration(
  userId: string,
  projectId: string,
  input: {
    prompt: string;
    durationMs: number;
    seedAssetId?: string;
    width: number;
    height: number;
  },
) {
  await guardProject(userId, projectId);
  await usage.assertAndIncrement(userId, 'VIDEO_GENERATIONS', 1);
  const { assertPromptAllowed } = await import('./moderation.service');
  try {
    await assertPromptAllowed(input.prompt);
  } catch (err) {
    await usage.increment(userId, 'VIDEO_GENERATIONS', -1);
    throw err;
  }

  const job = await enqueue({
    userId,
    projectId,
    kind: 'VIDEO_GENERATE',
    taskName: 'vrs.video.generate',
    payload: {
      prompt: input.prompt,
      duration_ms: input.durationMs,
      seed_asset_id: input.seedAssetId ?? null,
      width: input.width,
      height: input.height,
      output_key_prefix: `projects/${projectId}/videos`,
    },
    idempotencyKey: idem(userId, projectId, 'video', input),
  });
  return { jobId: job.id };
}

// ─── Thumbnail (poster) ─────────────────────────────────────────────────

export async function requestThumbnail(
  userId: string,
  projectId: string,
  input: { assetId: string; atSeconds?: number; width?: number },
) {
  await guardProject(userId, projectId);
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, userId },
  });
  if (!asset) throw Errors.notFound('Asset');

  const outputKey = `thumbnails/${asset.id}-${Date.now()}.jpg`;
  const job = await enqueue({
    userId,
    projectId,
    kind: 'THUMBNAIL_GENERATE',
    taskName: 'vrs.thumbnail.generate',
    payload: {
      asset_bucket: asset.s3Bucket,
      asset_key: asset.s3Key,
      output_key: outputKey,
      at_seconds: input.atSeconds ?? 1.0,
      width: input.width ?? 720,
    },
    idempotencyKey: idem(userId, projectId, 'thumb', input),
  });
  return { jobId: job.id, thumbnailKey: outputKey };
}

// ─── Export ─────────────────────────────────────────────────────────────

export async function requestExport(
  userId: string,
  projectId: string,
  input: RequestExport,
) {
  const project = await guardProject(userId, projectId);
  const durationMinutes = Math.max(
    1,
    Math.ceil((await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { durationMs: true } })).durationMs / 60_000),
  );
  await usage.assertAndIncrement(userId, 'EXPORT_MINUTES', durationMinutes);

  const activeSub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
    include: { plan: true },
  });
  const watermark = !activeSub || (activeSub.plan.limitsJson as Record<string, unknown>).watermark === true;

  const exportRow = await prisma.export.create({
    data: {
      projectId,
      userId,
      format: input.format,
      resolutionW: input.resolutionW,
      resolutionH: input.resolutionH,
      fps: input.fps,
      bitrateKbps: input.bitrateKbps ?? null,
      status: 'QUEUED',
      progress: 0,
      watermark,
    },
  });

  const job = await enqueue({
    userId,
    projectId,
    kind: 'EXPORT_RENDER',
    taskName: 'vrs.export.render',
    payload: {
      export_id: exportRow.id,
      project_id: projectId,
      format_: input.format,
      resolution_w: input.resolutionW,
      resolution_h: input.resolutionH,
      fps: input.fps,
      bitrate_kbps: input.bitrateKbps ?? null,
      burn_captions: input.burnCaptions,
      normalize_loudness: input.normalizeLoudness,
      watermark,
    },
    idempotencyKey: idem(userId, projectId, 'export', {
      ...input,
      exportId: exportRow.id,
    }),
  });

  await prisma.export.update({
    where: { id: exportRow.id },
    data: { status: 'RENDERING', jobId: job.id },
  });
  // Reservation happened in assertAndIncrement above.

  return { exportId: exportRow.id, jobId: job.id, title: project.title };
}
