import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  cancelSubscriptionSchema,
  customerPortalResponseSchema,
  invoiceSchema,
  pageOf,
  planSchema,
  startCheckoutResponseSchema,
  startCheckoutSchema,
  subscriptionSchema,
  usageSummarySchema,
} from '@vrs/types';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { getStripe } from '../config/stripe';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';
import { requireAuth } from '../middleware/auth';
import { audit } from '../services/audit.service';
import * as billing from '../services/billing.service';
import * as usage from '../services/usage.service';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Public: plan catalog
  app.get('/billing/plans', {
    schema: { tags: ['billing'], response: { 200: pageOf(planSchema) } },
    handler: async () => {
      const plans = await prisma.plan.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ sortOrder: 'asc' }],
      });
      return {
        items: plans.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          monthlyPriceCents: p.monthlyPriceCents,
          annualPriceCents: p.annualPriceCents,
          currency: p.currency,
          trialDays: p.trialDays,
          limits: p.limitsJson as Record<string, number | boolean>,
          features: p.featuresJson as string[],
          highlight: p.highlight,
        })),
        nextCursor: null,
      };
    },
  });

  // Authed: current subscription
  app.get('/billing/subscription', {
    schema: { tags: ['billing'], response: { 200: subscriptionSchema.nullable() } },
    preHandler: requireAuth,
    handler: async (req) => {
      const sub = await prisma.subscription.findFirst({
        where: { userId: req.auth!.sub, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) return null;
      return {
        id: sub.id,
        planCode: sub.plan.code,
        status: sub.status,
        interval: sub.interval,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt?.toISOString() ?? null,
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      };
    },
  });

  // Authed: usage summary for the current period
  app.get('/billing/usage', {
    schema: { tags: ['billing'], response: { 200: pageOf(usageSummarySchema) } },
    preHandler: requireAuth,
    handler: async (req) => {
      const items = await usage.getSummary(req.auth!.sub);
      return { items, nextCursor: null };
    },
  });

  // Authed: list invoices
  app.get('/billing/invoices', {
    schema: { tags: ['billing'], response: { 200: pageOf(invoiceSchema) } },
    preHandler: requireAuth,
    handler: async (req) => {
      const invoices = await prisma.invoice.findMany({
        where: { userId: req.auth!.sub },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      return {
        items: invoices.map((i) => ({
          id: i.id,
          number: i.number,
          amountCents: i.amountCents,
          currency: i.currency,
          status: i.status,
          hostedInvoiceUrl: i.hostedInvoiceUrl,
          invoicePdfUrl: i.invoicePdfUrl,
          periodStart: i.periodStart.toISOString(),
          periodEnd: i.periodEnd.toISOString(),
          paidAt: i.paidAt?.toISOString() ?? null,
          createdAt: i.createdAt.toISOString(),
        })),
        nextCursor: null,
      };
    },
  });

  // Authed: start Stripe checkout
  app.post('/billing/checkout', {
    schema: {
      tags: ['billing'],
      body: startCheckoutSchema,
      response: { 200: startCheckoutResponseSchema },
    },
    preHandler: requireAuth,
    handler: async (req) => {
      const body = startCheckoutSchema.parse(req.body);
      if (body.planCode === 'FREE' || body.planCode === 'ENTERPRISE') {
        throw Errors.unprocessable('That plan does not use Stripe checkout');
      }
      const checkoutUrl = await billing.startCheckout({
        userId: req.auth!.sub,
        planCode: body.planCode,
        interval: body.interval,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      });
      audit({
        actorId: req.auth!.sub,
        action: 'billing.checkout.started',
        targetType: 'plan',
        targetId: body.planCode,
        ip: req.ip,
        meta: { interval: body.interval },
      });
      return { checkoutUrl };
    },
  });

  // Authed: open Stripe customer portal
  app.post('/billing/portal', {
    schema: {
      tags: ['billing'],
      body: z.object({ returnUrl: z.string().url().optional() }).optional(),
      response: { 200: customerPortalResponseSchema },
    },
    preHandler: requireAuth,
    handler: async (req) => {
      const body = z.object({ returnUrl: z.string().url().optional() }).optional().parse(req.body);
      const portalUrl = await billing.openCustomerPortal(req.auth!.sub, body?.returnUrl);
      return { portalUrl };
    },
  });

  // Authed: one-click cancel
  app.post('/billing/cancel', {
    schema: {
      tags: ['billing'],
      body: cancelSubscriptionSchema,
      response: { 200: z.object({ ok: z.literal(true) }) },
    },
    preHandler: requireAuth,
    handler: async (req) => {
      const body = cancelSubscriptionSchema.parse(req.body);
      await billing.cancelActiveSubscription(req.auth!.sub, body.immediate);
      audit({
        actorId: req.auth!.sub,
        action: 'billing.subscription.canceled',
        ip: req.ip,
        meta: { immediate: body.immediate, reason: body.reason ?? null },
      });
      return { ok: true as const };
    },
  });

  // Stripe webhook — raw body needed for signature verification
  app.post('/billing/webhook', {
    config: {
      // Disable rate limit for webhook endpoint
      rateLimit: { max: 1000, timeWindow: '1 minute' },
    },
    schema: { tags: ['billing'] },
    bodyLimit: 4_194_304,
    handler: async (req, reply) => {
      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        throw Errors.badRequest('Missing stripe-signature header');
      }
      if (!env.STRIPE_WEBHOOK_SECRET) {
        throw Errors.internal('STRIPE_WEBHOOK_SECRET is not configured');
      }
      const raw = (req as { rawBody?: Buffer }).rawBody;
      if (!raw) {
        // Fastify gives us the parsed body; reconstruct as string for signature verification.
        const text = JSON.stringify(req.body);
        try {
          const event = getStripe().webhooks.constructEvent(text, sig, env.STRIPE_WEBHOOK_SECRET);
          await billing.handleWebhookEvent(event);
        } catch (err) {
          logger.error({ err }, 'webhook.invalid_signature');
          throw Errors.badRequest('Invalid signature');
        }
      } else {
        const event = getStripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
        await billing.handleWebhookEvent(event);
      }
      reply.code(200).send({ received: true });
    },
  });
}
