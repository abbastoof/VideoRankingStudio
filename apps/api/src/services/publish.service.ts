/**
 * Publish targets & jobs.
 *
 * Publishing an export means:
 *   1. User connects a platform account via OAuth (PublishTarget row).
 *   2. When they publish an export, we create a PublishJob and enqueue a
 *      worker task that uses the target's refresh token to upload.
 *
 * Access + refresh tokens are stored AES-256-GCM encrypted at rest.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import type { PublishProvider } from '@vrs/db';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { enqueue } from './jobs.service';

const KEY = scryptSync(env.JWT_ACCESS_SECRET, 'vrs-publish-token', 32);
const IV_LEN = 12;

function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + 16);
  const enc = raw.subarray(IV_LEN + 16);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export async function listTargets(userId: string) {
  const rows = await prisma.publishTarget.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((t) => ({
    id: t.id,
    provider: t.provider,
    providerAccountId: t.providerAccountId,
    displayName: t.displayName,
    scopes: t.scopesJson as string[],
    expiresAt: t.expiresAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function upsertTarget(
  userId: string,
  input: {
    provider: PublishProvider;
    providerAccountId: string;
    displayName?: string | null;
    accessToken: string;
    refreshToken?: string | null;
    scopes: string[];
    expiresAt?: Date | null;
  },
) {
  const row = await prisma.publishTarget.upsert({
    where: {
      provider_providerAccountId: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    update: {
      userId,
      displayName: input.displayName ?? null,
      accessTokenEnc: encryptToken(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken) : null,
      scopesJson: input.scopes,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    },
    create: {
      userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      displayName: input.displayName ?? null,
      accessTokenEnc: encryptToken(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken) : null,
      scopesJson: input.scopes,
      expiresAt: input.expiresAt ?? null,
    },
  });
  return row;
}

export async function revokeTarget(userId: string, targetId: string) {
  const res = await prisma.publishTarget.updateMany({
    where: { id: targetId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) throw Errors.notFound('Publish target');
}

export interface DecryptedTarget {
  id: string;
  provider: PublishProvider;
  accessToken: string;
  refreshToken: string | null;
  providerAccountId: string;
}

export async function getDecryptedTarget(targetId: string): Promise<DecryptedTarget> {
  const t = await prisma.publishTarget.findUniqueOrThrow({ where: { id: targetId } });
  return {
    id: t.id,
    provider: t.provider,
    providerAccountId: t.providerAccountId,
    accessToken: decryptToken(t.accessTokenEnc),
    refreshToken: t.refreshTokenEnc ? decryptToken(t.refreshTokenEnc) : null,
  };
}

export async function requestPublish(
  userId: string,
  input: {
    exportId: string;
    targetId: string;
    title: string;
    description?: string;
    tags?: string[];
    privacy: 'public' | 'unlisted' | 'private';
  },
) {
  const [exp, target] = await Promise.all([
    prisma.export.findFirst({ where: { id: input.exportId, userId } }),
    prisma.publishTarget.findFirst({
      where: { id: input.targetId, userId, revokedAt: null },
    }),
  ]);
  if (!exp) throw Errors.notFound('Export');
  if (exp.status !== 'COMPLETED' || !exp.s3Bucket || !exp.s3Key) {
    throw Errors.conflict('Export is not ready to publish');
  }
  if (!target) throw Errors.notFound('Publish target');

  const job = await prisma.publishJob.create({
    data: {
      exportId: exp.id,
      targetId: target.id,
      projectId: exp.projectId,
      status: 'QUEUED',
      metadataJson: {
        title: input.title,
        description: input.description ?? '',
        tags: input.tags ?? [],
        privacy: input.privacy,
      },
    },
  });

  const aiJob = await enqueue({
    userId,
    projectId: exp.projectId,
    kind: 'EXPORT_RENDER', // there isn't a dedicated PUBLISH kind — treat as a task
    taskName: `vrs.publish.${target.provider.toLowerCase()}`,
    payload: {
      publish_job_id: job.id,
      target_id: target.id,
      export_id: exp.id,
      s3_bucket: exp.s3Bucket,
      s3_key: exp.s3Key,
      title: input.title,
      description: input.description ?? '',
      tags: input.tags ?? [],
      privacy: input.privacy,
    },
  });

  await prisma.publishJob.update({
    where: { id: job.id },
    data: { status: 'PUBLISHING' },
  });

  return { publishJobId: job.id, jobId: aiJob.id };
}

export async function listPublishJobs(userId: string, projectId?: string) {
  const rows = await prisma.publishJob.findMany({
    where: {
      export: { userId },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { target: { select: { provider: true, displayName: true } } },
  });
  return rows.map((j) => ({
    id: j.id,
    exportId: j.exportId,
    projectId: j.projectId,
    provider: j.target.provider,
    targetDisplayName: j.target.displayName,
    status: j.status,
    providerVideoId: j.providerVideoId,
    providerUrl: j.providerUrl,
    errorMessage: j.errorMessage,
    metadata: j.metadataJson as Record<string, unknown>,
    publishedAt: j.publishedAt?.toISOString() ?? null,
    createdAt: j.createdAt.toISOString(),
  }));
}
