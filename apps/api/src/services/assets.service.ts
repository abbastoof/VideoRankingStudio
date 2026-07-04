import type { ImportUrl } from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { objectExists, presignGet } from './storage.service';
import { enqueue } from './jobs.service';

export async function completeUpload(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw Errors.notFound('Asset');
  if (asset.status === 'READY') return serializeAsset(asset);

  const exists = await objectExists('uploads', asset.s3Key);
  if (!exists) {
    throw Errors.conflict('Upload has not finished — please retry the PUT');
  }

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: { status: 'UPLOADED' },
  });

  // Kick off thumbnail extraction for video/image (best-effort, no blocking).
  if (updated.kind === 'VIDEO') {
    await enqueue({
      userId,
      kind: 'THUMBNAIL_GENERATE',
      taskName: 'vrs.thumbnail.generate',
      payload: {
        asset_bucket: 'uploads',
        asset_key: updated.s3Key,
        output_key: `thumbnails/${updated.id}.jpg`,
        at_seconds: 1.0,
        asset_id: updated.id,
      },
    });
  }

  return serializeAsset(updated);
}

/**
 * Hosts we let yt-dlp fetch from. The worker will download whatever URL we
 * hand it, so an open URL field is an SSRF vector (internal IPs, metadata
 * endpoints) and a free-tier abuse vector (arbitrary large downloads).
 */
const IMPORT_HOST_ALLOWLIST = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'instagr.am',
];

function assertImportableUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Errors.unprocessable('That does not look like a valid URL');
  }
  if (url.protocol !== 'https:') {
    throw Errors.unprocessable('Only https:// links can be imported');
  }
  const host = url.hostname.toLowerCase();
  const allowed = IMPORT_HOST_ALLOWLIST.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  if (!allowed) {
    throw Errors.unprocessable(
      'Only YouTube, TikTok, and Instagram links are supported',
      { supported: IMPORT_HOST_ALLOWLIST },
    );
  }
}

export async function importFromUrl(userId: string, body: ImportUrl) {
  assertImportableUrl(body.url);

  const asset = await prisma.asset.create({
    data: {
      userId,
      projectId: body.projectId ?? null,
      kind: body.audioOnly ? 'AUDIO' : 'VIDEO',
      source: 'URL_IMPORT',
      status: 'PROCESSING',
      mimeType: body.audioOnly ? 'audio/mpeg' : 'video/mp4',
      s3Bucket: 'uploads',
      s3Key: '', // assigned by worker on completion
      originUrl: body.url,
    },
  });

  const job = await enqueue({
    userId,
    projectId: body.projectId,
    kind: 'URL_IMPORT',
    taskName: 'vrs.import.url',
    payload: {
      asset_id: asset.id,
      url: body.url,
      audio_only: body.audioOnly,
      output_key_prefix: `imports/${userId.slice(0, 6)}/${asset.id.slice(0, 4)}`,
    },
  });

  return { assetId: asset.id, jobId: job.id };
}

export async function getAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw Errors.notFound('Asset');
  return serializeAsset(asset);
}

export async function listAssets(userId: string, opts: { projectId?: string; limit: number; cursor?: string }) {
  const assets = await prisma.asset.findMany({
    where: { userId, ...(opts.projectId ? { projectId: opts.projectId } : {}) },
    take: opts.limit + 1,
    orderBy: { createdAt: 'desc' },
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
  });
  let nextCursor: string | null = null;
  if (assets.length > opts.limit) {
    nextCursor = assets[opts.limit - 1]?.id ?? null;
    assets.pop();
  }
  const items = await Promise.all(assets.map((a) => serializeAsset(a)));
  return { items, nextCursor };
}

async function serializeAsset(a: Awaited<ReturnType<typeof prisma.asset.findFirst>>) {
  if (!a) throw Errors.notFound('Asset');
  let url: string | null = null;
  let thumbnailUrl: string | null = null;
  if (a.status === 'READY' || a.status === 'UPLOADED') {
    url = await presignGet({
      bucket: a.s3Bucket as 'uploads' | 'generated' | 'exports' | 'public',
      key: a.s3Key,
      expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS,
    });
  }
  if (a.thumbnailKey) {
    thumbnailUrl = await presignGet({ bucket: 'public', key: a.thumbnailKey });
  }
  return {
    id: a.id,
    projectId: a.projectId,
    kind: a.kind,
    source: a.source,
    status: a.status,
    mimeType: a.mimeType,
    sizeBytes: Number(a.sizeBytes),
    durationMs: a.durationMs,
    width: a.width,
    height: a.height,
    fps: a.fps,
    url,
    thumbnailUrl,
    createdAt: a.createdAt.toISOString(),
  };
}
