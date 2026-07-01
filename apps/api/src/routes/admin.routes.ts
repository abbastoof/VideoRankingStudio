import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  abuseReportSchema,
  adminMetricsSchema,
  adminUserListItemSchema,
  adminUserListQuerySchema,
  pageOf,
  updateUserSchema,
} from '@vrs/types';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/audit.service';
import { revokeAllSessionsForUser } from '../services/auth.service';

const idParams = z.object({ id: z.string() });

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  // ─── Dashboard metrics ──────────────────────────────────────────────
  app.get('/admin/metrics', {
    schema: { tags: ['admin'], response: { 200: adminMetricsSchema } },
    handler: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

      const [totalUsers, activeUsers, paidUsers, mrrRow, exportsLast24h, jobBacklog] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { lastSeenAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
        prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
        prisma.$queryRaw<Array<{ mrr: number }>>`
          SELECT COALESCE(SUM(
            CASE WHEN s."interval" = 'MONTH' THEN
              CASE WHEN s."cancelAtPeriodEnd" THEN 0 ELSE p."monthlyPriceCents" END
            ELSE p."annualPriceCents" / 12
            END
          ), 0)::int AS mrr
          FROM "Subscription" s
          JOIN "Plan" p ON p.id = s."planId"
          WHERE s."status" IN ('ACTIVE', 'TRIALING')
        `,
        prisma.export.count({ where: { createdAt: { gte: yesterday } } }),
        prisma.aiJob.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'RETRYING'] } } }),
      ]);

      return {
        totalUsers,
        activeUsersLast30Days: activeUsers,
        paidUsers,
        mrrCents: mrrRow[0]?.mrr ?? 0,
        exportsLast24h,
        jobBacklog,
      };
    },
  });

  // ─── User list ──────────────────────────────────────────────────────
  app.get('/admin/users', {
    schema: {
      tags: ['admin'],
      querystring: adminUserListQuerySchema,
      response: { 200: pageOf(adminUserListItemSchema) },
    },
    handler: async (req) => {
      const q = adminUserListQuerySchema.parse(req.query);
      const users = await prisma.user.findMany({
        where: {
          ...(q.role ? { role: q.role } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.search
            ? {
                OR: [
                  { email: { contains: q.search, mode: 'insensitive' as const } },
                  { name: { contains: q.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        take: q.limit + 1,
        orderBy: { createdAt: 'desc' },
        ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { plan: { select: { code: true } } },
          },
        },
      });
      let nextCursor: string | null = null;
      if (users.length > q.limit) {
        nextCursor = users[q.limit - 1]?.id ?? null;
        users.pop();
      }
      return {
        items: users.map((u) => {
          const sub = u.subscriptions[0];
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            status: u.status,
            planCode: sub?.plan.code ?? 'FREE',
            subscriptionStatus: sub?.status ?? null,
            projectsCount: u.projectsCount,
            exportsCount: u.exportsCount,
            lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
            createdAt: u.createdAt.toISOString(),
          };
        }),
        nextCursor,
      };
    },
  });

  app.get('/admin/users/:id', {
    schema: { tags: ['admin'], params: idParams },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
          },
          invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
          usageRecords: { orderBy: { periodStart: 'desc' }, take: 10 },
        },
      });
      if (!user) throw Errors.notFound('User');
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        imageUrl: user.imageUrl,
        locale: user.locale,
        timezone: user.timezone,
        marketingOptIn: user.marketingOptIn,
        projectsCount: user.projectsCount,
        exportsCount: user.exportsCount,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        subscriptions: user.subscriptions.map((s) => ({
          id: s.id,
          planCode: s.plan.code,
          status: s.status,
          interval: s.interval,
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
        invoices: user.invoices.map((i) => ({
          id: i.id,
          number: i.number,
          amountCents: i.amountCents,
          currency: i.currency,
          status: i.status,
          createdAt: i.createdAt.toISOString(),
        })),
        usageRecords: user.usageRecords.map((u) => ({
          kind: u.kind,
          used: Number(u.used),
          limit: Number(u.limit),
          periodStart: u.periodStart.toISOString(),
        })),
      };
    },
  });

  app.patch('/admin/users/:id', {
    schema: { tags: ['admin'], params: idParams, body: updateUserSchema },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      const body = updateUserSchema.parse(req.body);
      const before = await prisma.user.findUnique({ where: { id } });
      if (!before) throw Errors.notFound('User');

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });
      audit({
        actorId: req.auth!.sub,
        action: 'admin.user.updated',
        targetType: 'user',
        targetId: id,
        ip: req.ip,
        meta: { before: { role: before.role, status: before.status }, after: body },
      });
      return { id: user.id, role: user.role, status: user.status };
    },
  });

  app.post('/admin/users/:id/revoke-sessions', {
    schema: { tags: ['admin'], params: idParams },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      await revokeAllSessionsForUser(id);
      audit({
        actorId: req.auth!.sub,
        action: 'admin.user.sessions_revoked',
        targetType: 'user',
        targetId: id,
        ip: req.ip,
      });
      return { ok: true as const };
    },
  });

  // ─── Subscriptions ─────────────────────────────────────────────────
  app.get('/admin/subscriptions', {
    schema: { tags: ['admin'] },
    handler: async () => {
      const rows = await prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, email: true } },
          plan: { select: { code: true, monthlyPriceCents: true } },
        },
      });
      return {
        items: rows.map((s) => ({
          id: s.id,
          userId: s.userId,
          userEmail: s.user.email,
          planCode: s.plan.code,
          status: s.status,
          interval: s.interval,
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          mrrCents:
            s.interval === 'MONTH'
              ? s.plan.monthlyPriceCents
              : Math.round(s.plan.monthlyPriceCents / 1),
        })),
        nextCursor: null,
      };
    },
  });

  // ─── Abuse reports queue ───────────────────────────────────────────
  app.get('/admin/abuse-reports', {
    schema: { tags: ['admin'], response: { 200: pageOf(abuseReportSchema) } },
    handler: async () => {
      const rows = await prisma.abuseReport.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { reporter: { select: { email: true } } },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          reporterEmail: r.reporter?.email ?? r.contactEmail,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor: null,
      };
    },
  });

  app.patch('/admin/abuse-reports/:id', {
    schema: {
      tags: ['admin'],
      params: idParams,
      body: z.object({
        status: z.enum(['RECEIVED', 'REVIEWING', 'ACTION_TAKEN', 'DISMISSED']),
        resolutionNote: z.string().max(2000).optional(),
      }),
    },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      const body = z
        .object({
          status: z.enum(['RECEIVED', 'REVIEWING', 'ACTION_TAKEN', 'DISMISSED']),
          resolutionNote: z.string().max(2000).optional(),
        })
        .parse(req.body);
      const row = await prisma.abuseReport.update({
        where: { id },
        data: {
          status: body.status,
          resolutionNote: body.resolutionNote ?? null,
          resolvedById: ['ACTION_TAKEN', 'DISMISSED'].includes(body.status) ? req.auth!.sub : null,
          resolvedAt: ['ACTION_TAKEN', 'DISMISSED'].includes(body.status) ? new Date() : null,
        },
      });
      audit({
        actorId: req.auth!.sub,
        action: `admin.abuse.${body.status.toLowerCase()}`,
        targetType: 'abuse_report',
        targetId: id,
        meta: body,
      });
      return { id: row.id, status: row.status };
    },
  });

  // ─── Support ticket queue ──────────────────────────────────────────
  app.get('/admin/tickets', {
    schema: { tags: ['admin'] },
    handler: async () => {
      const rows = await prisma.supportTicket.findMany({
        orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
        take: 100,
        include: { user: { select: { id: true, email: true } } },
      });
      return {
        items: rows.map((t) => ({
          id: t.id,
          userEmail: t.user.email,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          category: t.category,
          lastMessageAt: t.lastMessageAt.toISOString(),
          createdAt: t.createdAt.toISOString(),
        })),
        nextCursor: null,
      };
    },
  });

  // ─── Feature flags ─────────────────────────────────────────────────
  app.get('/admin/flags', {
    schema: { tags: ['admin'] },
    handler: async () => {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
      return {
        items: flags.map((f) => ({
          id: f.id,
          key: f.key,
          description: f.description,
          defaultOn: f.defaultOn,
          rolloutPercent: f.rolloutPercent,
          updatedAt: f.updatedAt.toISOString(),
        })),
        nextCursor: null,
      };
    },
  });

  app.patch('/admin/flags/:id', {
    schema: {
      tags: ['admin'],
      params: idParams,
      body: z.object({
        defaultOn: z.boolean().optional(),
        rolloutPercent: z.number().int().min(0).max(100).optional(),
      }),
    },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      const body = z
        .object({
          defaultOn: z.boolean().optional(),
          rolloutPercent: z.number().int().min(0).max(100).optional(),
        })
        .parse(req.body);
      const flag = await prisma.featureFlag.update({
        where: { id },
        data: body,
      });
      audit({
        actorId: req.auth!.sub,
        action: 'admin.flag.updated',
        targetType: 'flag',
        targetId: flag.key,
        meta: body,
      });
      return { id: flag.id, key: flag.key, defaultOn: flag.defaultOn, rolloutPercent: flag.rolloutPercent };
    },
  });

  // ─── Audit log ─────────────────────────────────────────────────────
  app.get('/admin/audit', {
    schema: {
      tags: ['admin'],
      querystring: z.object({
        actorId: z.string().optional(),
        action: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
    },
    handler: async (req) => {
      const q = z
        .object({
          actorId: z.string().optional(),
          action: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(req.query);
      const rows = await prisma.auditLog.findMany({
        where: {
          ...(q.actorId ? { actorId: q.actorId } : {}),
          ...(q.action ? { action: { contains: q.action } } : {}),
        },
        orderBy: { id: 'desc' },
        take: q.limit + 1,
        ...(q.cursor ? { skip: 1, cursor: { id: BigInt(q.cursor) } } : {}),
      });
      let nextCursor: string | null = null;
      if (rows.length > q.limit) {
        nextCursor = rows[q.limit - 1]?.id.toString() ?? null;
        rows.pop();
      }
      return {
        items: rows.map((r) => ({
          id: r.id.toString(),
          actorId: r.actorId,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          ip: r.ip,
          meta: r.metaJson,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor,
      };
    },
  });
}
