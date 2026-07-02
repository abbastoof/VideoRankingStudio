import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { updateProfileSchema, userProfileSchema } from '@vrs/types';

import { env } from '../config/env';
import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { revokeAllSessionsForUser, revokeSession } from '../services/auth.service';

const REFRESH_COOKIE = `${env.SESSION_COOKIE_NAME}_refresh`;

function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/users/me', {
    schema: { tags: ['users'], response: { 200: userProfileSchema } },
    handler: async (req) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.sub } });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
        status: user.status,
        locale: user.locale,
        timezone: user.timezone,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        marketingOptIn: user.marketingOptIn,
        createdAt: user.createdAt.toISOString(),
      };
    },
  });

  app.patch('/users/me', {
    schema: {
      tags: ['users'],
      body: updateProfileSchema,
      response: { 200: userProfileSchema },
    },
    handler: async (req) => {
      const body = updateProfileSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.auth!.sub },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.marketingOptIn !== undefined ? { marketingOptIn: body.marketingOptIn } : {}),
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
        status: user.status,
        locale: user.locale,
        timezone: user.timezone,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        marketingOptIn: user.marketingOptIn,
        createdAt: user.createdAt.toISOString(),
      };
    },
  });

  app.get('/users/me/sessions', {
    schema: { tags: ['users'] },
    handler: async (req) => {
      const sessions = await prisma.session.findMany({
        where: { userId: req.auth!.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });
      const currentId = req.auth!.sid;
      return {
        items: sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ip: s.ip,
          createdAt: s.createdAt.toISOString(),
          lastUsedAt: s.lastUsedAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          current: s.id === currentId,
        })),
        nextCursor: null,
      };
    },
  });

  app.delete('/users/me/sessions/:id', {
    schema: { tags: ['users'], params: z.object({ id: z.string() }) },
    handler: async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const s = await prisma.session.findFirst({
        where: { id, userId: req.auth!.sub },
      });
      if (!s) throw Errors.notFound('Session');
      await revokeSession(id);
      // If the caller revoked their own session, wipe the cookies so the
      // browser doesn't loop between the (auth) group and the protected
      // route group on the next navigation.
      if (id === req.auth!.sid) clearSessionCookies(reply);
      reply.code(204).send();
    },
  });

  app.post('/users/me/sessions/revoke-all', {
    schema: { tags: ['users'], response: { 200: z.object({ ok: z.literal(true) }) } },
    handler: async (req, reply) => {
      await revokeAllSessionsForUser(req.auth!.sub);
      // Revoke-all kills the caller's session too — clear cookies to prevent
      // a redirect loop against the presence-only web middleware.
      clearSessionCookies(reply);
      return { ok: true as const };
    },
  });

  app.delete('/users/me', {
    schema: { tags: ['users'], response: { 204: z.null() } },
    handler: async (req, reply) => {
      // Soft delete for GDPR-compliant grace period. A background purge job
      // hard-deletes after 30 days.
      await prisma.user.update({
        where: { id: req.auth!.sub },
        data: { status: 'PENDING_DELETION', deletedAt: new Date() },
      });
      await revokeAllSessionsForUser(req.auth!.sub);
      clearSessionCookies(reply);
      reply.code(204).send();
    },
  });
}
