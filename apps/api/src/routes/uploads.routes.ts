import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  assetSchema,
  completeUploadSchema,
  importUrlSchema,
  uploadInitResponseSchema,
  uploadInitSchema,
} from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import * as assets from '../services/assets.service';
import * as storage from '../services/storage.service';

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/uploads/init', {
    schema: {
      tags: ['uploads'],
      body: uploadInitSchema,
      response: { 200: uploadInitResponseSchema },
    },
    handler: async (req) => {
      const body = uploadInitSchema.parse(req.body);
      const userId = req.auth!.sub;

      if (body.sizeBytes > env.UPLOAD_MAX_BYTES) {
        throw Errors.unprocessable('File exceeds maximum allowed size', {
          maxBytes: env.UPLOAD_MAX_BYTES,
        });
      }

      const asset = await prisma.asset.create({
        data: {
          userId,
          projectId: body.projectId ?? null,
          kind: body.kind,
          source: 'UPLOAD',
          status: 'PENDING_UPLOAD',
          mimeType: body.mimeType,
          sizeBytes: BigInt(body.sizeBytes),
          s3Bucket: 'uploads',
          s3Key: storage.buildAssetKey(userId, 'pending', body.fileName),
        },
      });

      // Rewrite to the final key now that we have the cuid.
      const finalKey = storage.buildAssetKey(userId, asset.id, body.fileName);
      await prisma.asset.update({
        where: { id: asset.id },
        data: { s3Key: finalKey, sha256: body.sha256 ?? null },
      });

      const uploadUrl = await storage.presignPut({
        bucket: 'uploads',
        key: finalKey,
        contentType: body.mimeType,
        // Bind the presigned URL to the size the client committed to. Without
        // this, a malicious client can PUT any-size file since S3 has no
        // upstream check of what the API said it approved.
        contentLength: body.sizeBytes,
      });

      return {
        assetId: asset.id,
        uploadUrl,
        method: 'PUT' as const,
        expiresInSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS,
      };
    },
  });

  app.post('/uploads/complete', {
    schema: {
      tags: ['uploads'],
      body: completeUploadSchema,
      response: { 200: assetSchema },
    },
    handler: async (req) => {
      const body = completeUploadSchema.parse(req.body);
      const userId = req.auth!.sub;
      return assets.completeUpload(userId, body.assetId);
    },
  });

  app.post('/uploads/import', {
    schema: {
      tags: ['uploads'],
      body: importUrlSchema,
      response: { 202: z.object({ assetId: z.string(), jobId: z.string() }) },
    },
    handler: async (req, reply) => {
      const body = importUrlSchema.parse(req.body);
      const userId = req.auth!.sub;
      const out = await assets.importFromUrl(userId, body);
      reply.code(202);
      return out;
    },
  });
}
