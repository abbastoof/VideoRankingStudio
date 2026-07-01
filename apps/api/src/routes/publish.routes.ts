import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { audit } from '../services/audit.service';
import * as oauth from '../services/oauth.service';
import * as publish from '../services/publish.service';

const providerSchema = z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM']);

export async function publishRoutes(app: FastifyInstance): Promise<void> {
  // ─── Targets ──────────────────────────────────────────────────────
  app.get('/publish/targets', {
    schema: { tags: ['publish'] },
    preHandler: requireAuth,
    handler: async (req) => {
      const items = await publish.listTargets(req.auth!.sub);
      return { items, nextCursor: null };
    },
  });

  app.delete('/publish/targets/:id', {
    schema: { tags: ['publish'], params: z.object({ id: z.string() }) },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      await publish.revokeTarget(req.auth!.sub, id);
      audit({
        actorId: req.auth!.sub,
        action: 'publish.target.revoked',
        targetType: 'publish_target',
        targetId: id,
        ip: req.ip,
      });
      reply.code(204).send();
    },
  });

  // ─── OAuth handshake ─────────────────────────────────────────────
  app.get('/publish/oauth/:provider/authorize', {
    schema: { tags: ['publish'], params: z.object({ provider: providerSchema }) },
    preHandler: requireAuth,
    handler: async (req) => {
      const { provider } = z.object({ provider: providerSchema }).parse(req.params);
      const redirectUri = `${env.API_URL}/v1/publish/oauth/${provider.toLowerCase()}/callback`;
      if (provider === 'YOUTUBE') {
        return oauth.startYouTubeAuth(req.auth!.sub, redirectUri);
      }
      if (provider === 'TIKTOK') {
        return oauth.startTikTokAuth(req.auth!.sub, redirectUri);
      }
      throw Errors.unprocessable('Provider not supported yet');
    },
  });

  app.get('/publish/oauth/youtube/callback', {
    schema: {
      tags: ['publish'],
      querystring: z.object({ code: z.string(), state: z.string() }),
    },
    handler: async (req, reply) => {
      const q = z.object({ code: z.string(), state: z.string() }).parse(req.query);
      const result = await oauth.completeYouTubeAuth(q.code, q.state);
      const target = await publish.upsertTarget(result.userId, {
        provider: 'YOUTUBE',
        providerAccountId: result.providerAccountId,
        displayName: result.displayName,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        scopes: result.scopes,
        expiresAt: result.expiresAt,
      });
      audit({
        actorId: result.userId,
        action: 'publish.target.connected',
        targetType: 'publish_target',
        targetId: target.id,
        meta: { provider: 'YOUTUBE' },
      });
      reply.redirect(`${env.WEB_URL}/settings/publishing?connected=youtube`);
    },
  });

  app.get('/publish/oauth/tiktok/callback', {
    schema: {
      tags: ['publish'],
      querystring: z.object({ code: z.string(), state: z.string() }),
    },
    handler: async (req, reply) => {
      const q = z.object({ code: z.string(), state: z.string() }).parse(req.query);
      const result = await oauth.completeTikTokAuth(q.code, q.state);
      const target = await publish.upsertTarget(result.userId, {
        provider: 'TIKTOK',
        providerAccountId: result.providerAccountId,
        displayName: result.displayName,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        scopes: result.scopes,
        expiresAt: result.expiresAt,
      });
      audit({
        actorId: result.userId,
        action: 'publish.target.connected',
        targetType: 'publish_target',
        targetId: target.id,
        meta: { provider: 'TIKTOK' },
      });
      reply.redirect(`${env.WEB_URL}/settings/publishing?connected=tiktok`);
    },
  });

  // ─── Publish an export ───────────────────────────────────────────
  const requestPublishSchema = z.object({
    exportId: z.string(),
    targetId: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
    privacy: z.enum(['public', 'unlisted', 'private']).default('public'),
  });

  app.post('/publish', {
    schema: {
      tags: ['publish'],
      body: requestPublishSchema,
      response: {
        202: z.object({ publishJobId: z.string(), jobId: z.string() }),
      },
    },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const body = requestPublishSchema.parse(req.body);
      const out = await publish.requestPublish(req.auth!.sub, body);
      audit({
        actorId: req.auth!.sub,
        action: 'publish.job.requested',
        targetType: 'publish_job',
        targetId: out.publishJobId,
        meta: { targetId: body.targetId, privacy: body.privacy },
      });
      reply.code(202);
      return out;
    },
  });

  app.get('/publish/jobs', {
    schema: {
      tags: ['publish'],
      querystring: z.object({ projectId: z.string().optional() }),
    },
    preHandler: requireAuth,
    handler: async (req) => {
      const q = z.object({ projectId: z.string().optional() }).parse(req.query);
      const items = await publish.listPublishJobs(req.auth!.sub, q.projectId);
      return { items, nextCursor: null };
    },
  });
}
