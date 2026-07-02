import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  authSessionSchema,
  otpRequestResponseSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshResponseSchema,
  signOutResponseSchema,
} from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { Errors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { audit } from '../services/audit.service';
import {
  findOrCreateUserByEmail,
  issueSession,
  revokeSession,
  rotateSession,
} from '../services/auth.service';
import * as oauth from '../services/oauth.service';
import { issueOtp, verifyOtp } from '../services/otp.service';

const REFRESH_COOKIE = `${env.SESSION_COOKIE_NAME}_refresh`;

function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: env.SESSION_COOKIE_SAMESITE,
    path: '/',
    domain: env.SESSION_COOKIE_DOMAIN,
    maxAge: maxAgeSeconds,
  } as const;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/otp/request', {
    schema: {
      tags: ['auth'],
      body: otpRequestSchema,
      response: { 200: otpRequestResponseSchema },
    },
    config: { rateLimit: { max: env.RATE_LIMIT_AUTH_PER_MINUTE, timeWindow: '1 minute' } },
    handler: async (req) => {
      const body = otpRequestSchema.parse(req.body);
      const result = await issueOtp({
        email: body.email,
        purpose: body.purpose === 'SIGN_UP' ? 'SIGN_UP' : 'SIGN_IN',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      audit({
        action: 'auth.otp.requested',
        targetType: 'email',
        targetId: body.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        meta: { purpose: body.purpose },
      });
      return {
        delivered: true,
        expiresInSeconds: result.expiresInSeconds,
        resendCooldownSeconds: result.resendCooldownSeconds,
      };
    },
  });

  app.post('/auth/otp/verify', {
    schema: {
      tags: ['auth'],
      body: otpVerifySchema,
      response: { 200: authSessionSchema },
    },
    config: { rateLimit: { max: env.RATE_LIMIT_AUTH_PER_MINUTE, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = otpVerifySchema.parse(req.body);

      // Try SIGN_IN first, fall back to SIGN_UP for new accounts.
      let verified;
      try {
        verified = await verifyOtp({ email: body.email, code: body.code, purpose: 'SIGN_IN' });
      } catch {
        verified = await verifyOtp({ email: body.email, code: body.code, purpose: 'SIGN_UP' });
      }

      const user = await findOrCreateUserByEmail(verified.email);
      const session = await issueSession(user, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      audit({
        actorId: user.id,
        action: 'auth.signed_in',
        targetType: 'session',
        targetId: session.sessionId,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });

      reply.setCookie(env.SESSION_COOKIE_NAME, session.accessToken, cookieOpts(env.JWT_ACCESS_TTL_SECONDS));
      reply.setCookie(REFRESH_COOKIE, session.refreshToken, cookieOpts(env.JWT_REFRESH_TTL_SECONDS));

      const planCode = await resolvePlanCode(user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          role: user.role,
          locale: user.locale,
          timezone: user.timezone,
          planCode,
        },
        expiresAt: session.expiresAt.toISOString(),
      };
    },
  });

  app.post('/auth/refresh', {
    schema: { tags: ['auth'], response: { 200: refreshResponseSchema } },
    handler: async (req, reply) => {
      const token = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
      if (!token) throw Errors.unauthorized();

      const session = await rotateSession(token, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      reply.setCookie(env.SESSION_COOKIE_NAME, session.accessToken, cookieOpts(env.JWT_ACCESS_TTL_SECONDS));
      reply.setCookie(REFRESH_COOKIE, session.refreshToken, cookieOpts(env.JWT_REFRESH_TTL_SECONDS));
      return { expiresAt: session.expiresAt.toISOString() };
    },
  });

  app.post('/auth/signout', {
    schema: { tags: ['auth'], response: { 200: signOutResponseSchema } },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      if (req.auth?.sid) {
        await revokeSession(req.auth.sid);
      }
      reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
      reply.clearCookie(REFRESH_COOKIE, { path: '/' });
      return { ok: true as const };
    },
  });

  app.get('/auth/session', {
    schema: { tags: ['auth'], response: { 200: authSessionSchema } },
    preHandler: requireAuth,
    handler: async (req) => {
      const userId = req.auth!.sub;
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const session = await prisma.session.findUniqueOrThrow({
        where: { id: req.auth!.sid },
        select: { expiresAt: true },
      });
      const planCode = await resolvePlanCode(user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          role: user.role,
          locale: user.locale,
          timezone: user.timezone,
          planCode,
        },
        expiresAt: session.expiresAt.toISOString(),
      };
    },
  });

  // ─── Google OAuth sign-in ───────────────────────────────────────────
  app.get('/auth/google/authorize', {
    schema: { tags: ['auth'] },
    handler: async () => {
      const redirectUri = `${env.API_URL}/v1/auth/google/callback`;
      return oauth.startGoogleSignIn(redirectUri);
    },
  });

  app.get('/auth/google/callback', {
    schema: {
      tags: ['auth'],
      querystring: z.object({ code: z.string(), state: z.string() }),
    },
    handler: async (req, reply) => {
      const q = z.object({ code: z.string(), state: z.string() }).parse(req.query);
      const redirectUri = `${env.API_URL}/v1/auth/google/callback`;
      const profile = await oauth.completeGoogleSignIn(q.code, q.state, redirectUri);
      const user = await findOrCreateUserByEmail(profile.email, profile.name);

      await prisma.account.upsert({
        where: {
          provider_providerSub: { provider: 'GOOGLE', providerSub: profile.sub },
        },
        update: { userId: user.id, email: profile.email },
        create: {
          userId: user.id,
          provider: 'GOOGLE',
          providerSub: profile.sub,
          email: profile.email,
        },
      });

      if (profile.imageUrl && !user.imageUrl) {
        await prisma.user.update({
          where: { id: user.id },
          data: { imageUrl: profile.imageUrl },
        });
      }

      const session = await issueSession(user, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      audit({
        actorId: user.id,
        action: 'auth.signed_in',
        targetType: 'session',
        targetId: session.sessionId,
        ip: req.ip,
        meta: { method: 'google' },
      });

      reply.setCookie(env.SESSION_COOKIE_NAME, session.accessToken, cookieOpts(env.JWT_ACCESS_TTL_SECONDS));
      reply.setCookie(REFRESH_COOKIE, session.refreshToken, cookieOpts(env.JWT_REFRESH_TTL_SECONDS));
      reply.redirect(`${env.WEB_URL}/dashboard`);
    },
  });
}

async function resolvePlanCode(userId: string): Promise<'FREE' | 'CREATOR' | 'BUSINESS' | 'ENTERPRISE'> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { code: true } } },
  });
  return sub?.plan.code ?? 'FREE';
}

