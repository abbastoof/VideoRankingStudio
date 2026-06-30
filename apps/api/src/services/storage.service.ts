import { createHash } from 'node:crypto';

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { buckets, getS3 } from '../config/storage';
import { env } from '../config/env';
import { Errors } from '../lib/errors';

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function buildAssetKey(userId: string, assetId: string, fileName: string): string {
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '_')
    .slice(-160);
  return `u/${userId.slice(0, 6)}/${assetId.slice(0, 4)}/${assetId}-${sanitized}`;
}

interface PresignPutOpts {
  bucket: keyof typeof buckets;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export async function presignPut(opts: PresignPutOpts): Promise<string> {
  if (!ALLOWED_MIME.has(opts.contentType)) {
    throw Errors.unprocessable('Unsupported media type', { mimeType: opts.contentType });
  }
  const cmd = new PutObjectCommand({
    Bucket: buckets[opts.bucket],
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(getS3(), cmd, {
    expiresIn: opts.expiresInSeconds ?? env.S3_PRESIGNED_URL_TTL_SECONDS,
  });
}

interface PresignGetOpts {
  bucket: keyof typeof buckets;
  key: string;
  expiresInSeconds?: number;
}

export async function presignGet(opts: PresignGetOpts): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: buckets[opts.bucket], Key: opts.key });
  return getSignedUrl(getS3(), cmd, {
    expiresIn: opts.expiresInSeconds ?? env.S3_PRESIGNED_URL_TTL_SECONDS,
  });
}

export async function objectExists(bucket: keyof typeof buckets, key: string): Promise<boolean> {
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: buckets[bucket], Key: key }));
    return true;
  } catch {
    return false;
  }
}

export function checksumFor(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export const allowedMimeTypes = ALLOWED_MIME;
