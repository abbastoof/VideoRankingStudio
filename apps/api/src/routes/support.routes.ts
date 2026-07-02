import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { audit } from '../services/audit.service';

const ticketParams = z.object({ id: z.string() });

const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(20_000),
  category: z.string().max(80).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

const replySchema = z.object({
  body: z.string().min(1).max(20_000),
  internal: z.boolean().optional(),
});

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/support/tickets', {
    schema: { tags: ['support'] },
    handler: async (req) => {
      const tickets = await prisma.supportTicket.findMany({
        where: { userId: req.auth!.sub },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      });
      return {
        items: tickets.map((t) => ({
          id: t.id,
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

  app.post('/support/tickets', {
    schema: { tags: ['support'], body: createTicketSchema },
    handler: async (req, reply) => {
      const body = createTicketSchema.parse(req.body);
      const ticket = await prisma.$transaction(async (tx) => {
        const t = await tx.supportTicket.create({
          data: {
            userId: req.auth!.sub,
            subject: body.subject,
            category: body.category ?? null,
            priority: body.priority ?? 'NORMAL',
            status: 'WAITING_SUPPORT',
          },
        });
        await tx.ticketMessage.create({
          data: {
            ticketId: t.id,
            authorId: req.auth!.sub,
            body: body.body,
          },
        });
        return t;
      });
      audit({
        actorId: req.auth!.sub,
        action: 'support.ticket.created',
        targetType: 'ticket',
        targetId: ticket.id,
        ip: req.ip,
      });
      reply.code(201);
      return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt.toISOString(),
        lastMessageAt: ticket.lastMessageAt.toISOString(),
      };
    },
  });

  app.get('/support/tickets/:id', {
    schema: { tags: ['support'], params: ticketParams },
    handler: async (req) => {
      const { id } = ticketParams.parse(req.params);
      const isStaff = req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPPORT';
      // Users can only see their own tickets. Staff (ADMIN/SUPPORT) can see
      // any ticket — the message-level filter still keeps `internal: true`
      // notes hidden from non-staff even when the endpoint is scoped down.
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id,
          ...(isStaff ? {} : { userId: req.auth!.sub }),
        },
        include: {
          messages: {
            where: isStaff ? {} : { internal: false },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, email: true, name: true, role: true } } },
          },
        },
      });
      if (!ticket) throw Errors.notFound('Ticket');
      return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt.toISOString(),
        lastMessageAt: ticket.lastMessageAt.toISOString(),
        messages: ticket.messages.map((m) => ({
          id: m.id,
          authorId: m.authorId,
          authorName: m.author.name ?? m.author.email.split('@')[0],
          authorRole: m.author.role,
          body: m.body,
          internal: m.internal,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  });

  app.post('/support/tickets/:id/reply', {
    schema: { tags: ['support'], params: ticketParams, body: replySchema },
    handler: async (req, reply) => {
      const { id } = ticketParams.parse(req.params);
      const body = replySchema.parse(req.body);
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id,
          OR: req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPPORT'
            ? undefined
            : [{ userId: req.auth!.sub }],
        },
      });
      if (!ticket) throw Errors.notFound('Ticket');
      const isStaff = req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPPORT';
      const msg = await prisma.$transaction(async (tx) => {
        const m = await tx.ticketMessage.create({
          data: {
            ticketId: id,
            authorId: req.auth!.sub,
            body: body.body,
            internal: (body.internal ?? false) && isStaff,
          },
        });
        await tx.supportTicket.update({
          where: { id },
          data: {
            lastMessageAt: new Date(),
            status: isStaff ? 'WAITING_USER' : 'WAITING_SUPPORT',
          },
        });
        return m;
      });
      audit({
        actorId: req.auth!.sub,
        action: 'support.ticket.replied',
        targetType: 'ticket',
        targetId: id,
        meta: { internal: msg.internal },
      });

      // Notify the other party when it isn't an internal note.
      if (!msg.internal) {
        const { notify } = await import('../services/notifications.service');
        if (isStaff) {
          notify({
            userId: ticket.userId,
            kind: 'TICKET_REPLY',
            title: 'Support replied to your ticket',
            body: ticket.subject,
            link: `/support/${ticket.id}`,
          });
        }
      }

      reply.code(201);
      return { id: msg.id, createdAt: msg.createdAt.toISOString() };
    },
  });

  app.post('/support/tickets/:id/close', {
    schema: { tags: ['support'], params: ticketParams },
    handler: async (req) => {
      const { id } = ticketParams.parse(req.params);
      const isStaff = req.auth!.role === 'ADMIN' || req.auth!.role === 'SUPPORT';
      await prisma.supportTicket.updateMany({
        where: {
          id,
          ...(isStaff ? {} : { userId: req.auth!.sub }),
        },
        data: { status: 'RESOLVED', closedAt: new Date() },
      });
      audit({
        actorId: req.auth!.sub,
        action: 'support.ticket.closed',
        targetType: 'ticket',
        targetId: id,
      });
      return { ok: true as const };
    },
  });
}
