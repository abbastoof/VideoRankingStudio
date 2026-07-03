import type Stripe from 'stripe';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { getStripe, priceIdFor } from '../config/stripe';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';

const SUB_STATUS_MAP: Record<Stripe.Subscription.Status, 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'PAUSED'> = {
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  paused: 'PAUSED',
};

const INVOICE_STATUS_MAP: Record<string, 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'> = {
  draft: 'DRAFT',
  open: 'OPEN',
  paid: 'PAID',
  void: 'VOID',
  uncollectible: 'UNCOLLECTIBLE',
};

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const existing = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  return customer.id;
}

export async function startCheckout(opts: {
  userId: string;
  planCode: 'CREATOR' | 'BUSINESS';
  interval: 'MONTH' | 'YEAR';
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const priceId = priceIdFor(opts.planCode, opts.interval);
  if (!priceId) {
    throw Errors.unprocessable('Pricing is not configured for that plan');
  }
  const customerId = await ensureStripeCustomer(opts.userId);
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: opts.userId, planCode: opts.planCode, interval: opts.interval },
    },
    metadata: { userId: opts.userId },
  });
  if (!session.url) throw Errors.internal('Stripe checkout returned no URL');
  return session.url;
}

export async function openCustomerPortal(userId: string, returnUrl?: string): Promise<string> {
  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl ?? env.STRIPE_CUSTOMER_PORTAL_RETURN_URL ?? env.WEB_URL,
  });
  return portal.url;
}

export async function cancelActiveSubscription(userId: string, immediate = false): Promise<void> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) throw Errors.notFound('Active subscription');
  const stripe = getStripe();

  if (immediate) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  }
}

/**
 * Stripe webhook ingestion. The webhook route already verifies the signature.
 *
 * Stripe retries failed deliveries and occasionally re-delivers healthy
 * events. The upsert-on-event-id below only protects the delivery row —
 * without an early-exit, a replay would fire `notify()` again for a
 * subscription cancellation the user has already been told about.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const existing = await prisma.webhookDelivery.findUnique({
    where: { source_externalId: { source: 'STRIPE', externalId: event.id } },
    select: { status: true },
  });
  if (existing?.status === 'PROCESSED') {
    // Already handled successfully in a prior delivery — acknowledge quickly
    // so Stripe stops retrying without touching downstream side effects.
    return;
  }

  await prisma.webhookDelivery.upsert({
    where: { source_externalId: { source: 'STRIPE', externalId: event.id } },
    create: {
      source: 'STRIPE',
      externalId: event.id,
      eventType: event.type,
      payloadJson: event as unknown as object,
      status: 'RECEIVED',
    },
    update: {},
  });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
        await recordInvoice(event.data.object as Stripe.Invoice);
        break;
      case 'checkout.session.completed':
        // Subscription record will follow via subscription.created; nothing to do.
        break;
      default:
        // Unhandled but acknowledged.
        break;
    }
    await prisma.webhookDelivery.update({
      where: { source_externalId: { source: 'STRIPE', externalId: event.id } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err) {
    logger.error({ err, eventId: event.id, type: event.type }, 'webhook.processing_failed');
    await prisma.webhookDelivery.update({
      where: { source_externalId: { source: 'STRIPE', externalId: event.id } },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'unknown',
        attempts: { increment: 1 },
      },
    });
    throw err;
  }
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = (sub.metadata as Record<string, string | undefined>)?.userId;
  if (!userId) {
    logger.warn({ stripeSubscriptionId: sub.id }, 'subscription.no_user_metadata');
    return;
  }

  const priceId = sub.items.data[0]?.price.id;
  const planCode = matchPlanByPrice(priceId);
  if (!planCode) {
    // A price we didn't recognise is a configuration bug we want to fail
    // loudly on — silently placing every unknown price into CREATOR meant
    // an env-var mistake could quietly downgrade or upgrade real users.
    logger.error({ priceId, stripeSubscriptionId: sub.id }, 'subscription.unknown_price');
    return;
  }
  const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'YEAR' : 'MONTH';

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) {
    logger.error({ planCode }, 'subscription.unknown_plan');
    return;
  }

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId,
      planId: plan.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      status: SUB_STATUS_MAP[sub.status],
      interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    update: {
      planId: plan.id,
      status: SUB_STATUS_MAP[sub.status],
      interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });
}

async function markSubscriptionCanceled(sub: Stripe.Subscription): Promise<void> {
  const rows = await prisma.subscription.findMany({
    where: { stripeSubscriptionId: sub.id },
    select: { userId: true },
  });
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(sub.canceled_at ? sub.canceled_at * 1000 : Date.now()),
      endedAt: new Date(),
    },
  });
  const { notify } = await import('./notifications.service');
  for (const row of rows) {
    notify({
      userId: row.userId,
      kind: 'SUBSCRIPTION_CANCELED',
      title: 'Subscription canceled',
      body: 'Your subscription has ended. You can resubscribe anytime from settings.',
      link: '/billing',
    });
  }
}

async function recordInvoice(inv: Stripe.Invoice): Promise<void> {
  if (!inv.customer || typeof inv.customer !== 'string') return;
  const sub = inv.subscription
    ? await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id },
      })
    : null;
  if (!sub) return;

  const before = await prisma.invoice.findUnique({ where: { stripeInvoiceId: inv.id } });
  const after = await prisma.invoice.upsert({
    where: { stripeInvoiceId: inv.id },
    create: {
      subscriptionId: sub.id,
      userId: sub.userId,
      stripeInvoiceId: inv.id,
      number: inv.number ?? null,
      amountCents: inv.amount_paid || inv.amount_due,
      taxCents: inv.tax ?? 0,
      currency: inv.currency,
      status: INVOICE_STATUS_MAP[inv.status ?? 'open'] ?? 'OPEN',
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdfUrl: inv.invoice_pdf ?? null,
      periodStart: new Date(inv.period_start * 1000),
      periodEnd: new Date(inv.period_end * 1000),
      paidAt: inv.status === 'paid' ? new Date(inv.status_transitions.paid_at ? inv.status_transitions.paid_at * 1000 : Date.now()) : null,
    },
    update: {
      status: INVOICE_STATUS_MAP[inv.status ?? 'open'] ?? 'OPEN',
      amountCents: inv.amount_paid || inv.amount_due,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdfUrl: inv.invoice_pdf ?? null,
      paidAt: inv.status === 'paid' ? new Date(inv.status_transitions.paid_at ? inv.status_transitions.paid_at * 1000 : Date.now()) : null,
    },
  });

  const { notify } = await import('./notifications.service');
  if (after.status === 'PAID' && before?.status !== 'PAID') {
    notify({
      userId: sub.userId,
      kind: 'PAYMENT_SUCCEEDED',
      title: 'Payment received',
      body: `Thanks — your ${(after.amountCents / 100).toFixed(2)} ${after.currency.toUpperCase()} invoice is paid.`,
      link: '/billing',
    });
  } else if (
    (after.status === 'UNCOLLECTIBLE' || inv.status === 'uncollectible' || inv.status === 'open') &&
    inv.attempt_count && inv.attempt_count > 0 &&
    before?.status !== after.status
  ) {
    notify({
      userId: sub.userId,
      kind: 'PAYMENT_FAILED',
      title: 'Payment failed',
      body: 'We couldn’t charge your card. Update your payment method to keep your plan active.',
      link: '/billing',
    });
  }
}

function matchPlanByPrice(priceId?: string): 'CREATOR' | 'BUSINESS' | null {
  if (!priceId) return null;
  if (
    priceId === env.STRIPE_PRICE_CREATOR_MONTHLY ||
    priceId === env.STRIPE_PRICE_CREATOR_ANNUAL
  ) {
    return 'CREATOR';
  }
  if (
    priceId === env.STRIPE_PRICE_BUSINESS_MONTHLY ||
    priceId === env.STRIPE_PRICE_BUSINESS_ANNUAL
  ) {
    return 'BUSINESS';
  }
  return null;
}
