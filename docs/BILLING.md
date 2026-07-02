# Billing

Stripe is the source of truth for subscriptions and invoices. This document
covers how the pieces fit together end-to-end.

## Plan catalog

Plans live in the `Plan` table and are seeded via `pnpm db:seed`. Each
plan carries:

- `code` — stable identifier (`FREE`, `CREATOR`, `BUSINESS`, `ENTERPRISE`).
- `monthlyPriceCents` / `annualPriceCents` and `currency`.
- `trialDays` — trial length for paid plans.
- `limitsJson` — per-plan usage caps (projects/month, voiceover chars,
  exports, feature flags).
- `featuresJson` — human-facing bullet list rendered on `/pricing`.
- `stripeMonthlyPriceId` / `stripeAnnualPriceId` — mapped from
  `STRIPE_PRICE_*` env vars.

The catalog is exposed publicly at `GET /v1/billing/plans` (no auth) so the
marketing site renders live plan data.

## Sign-up → paid conversion

1. Marketing `/pricing` reads `GET /v1/billing/plans` and links to
   `/signin?intent=signup&plan=<CODE>`.
2. User verifies email, arrives on the dashboard.
3. In-app upgrade calls `POST /v1/billing/checkout` with
   `{ planCode, interval, successUrl, cancelUrl }`.
4. API creates or reuses a Stripe Customer, generates a Checkout Session,
   and returns `{ checkoutUrl }`. The `FREE` and `ENTERPRISE` codes are
   rejected here — they don't route through Stripe.
5. User completes Checkout on Stripe; the webhook (below) updates our
   Subscription row and we redirect them to `successUrl`.

## Portal

`POST /v1/billing/portal` opens a Stripe Customer Portal session for the
authenticated user. All payment-method changes, invoice downloads, and
downgrades happen there — we don't reimplement Stripe's UI.

## Cancellation

`POST /v1/billing/cancel` with `{ immediate?: boolean, reason?: string }`:

- Default (`immediate=false`) schedules the cancel at period end. The user
  keeps full access; no charge on renewal.
- `immediate=true` cancels now and prorates according to Stripe's default.
  Used only for support-driven cancellations.

An audit-log entry (`billing.subscription.canceled`) is written with the
reason.

## Webhooks

Stripe posts to `POST /v1/billing/webhook`. Signature verification uses
`STRIPE_WEBHOOK_SECRET`; without a valid signature the request is rejected
with `400`. The handler is idempotent — repeated deliveries of the same
Stripe event are safe.

Events we act on:

| Event | Action |
| --- | --- |
| `checkout.session.completed` | Attach or update the Subscription row. |
| `customer.subscription.updated` | Reconcile status, interval, `currentPeriodEnd`, `cancelAtPeriodEnd`. |
| `customer.subscription.deleted` | Move the Subscription to `CANCELED` and downgrade the user to `FREE` limits. |
| `invoice.paid` | Mirror the Invoice row + set `paidAt`. |
| `invoice.payment_failed` | Move Subscription to `PAST_DUE` and notify the user. |
| `customer.subscription.trial_will_end` | Notify the user three days before charge. |

All handlers are pure with respect to the DB — no external side effects
inside the transaction — so a Stripe retry replays cleanly.

## Quotas and usage tracking

The `UsageRecord` table stores per-period counters per user per metric
(`projects`, `voiceover_chars`, `exports`, etc.). On every billable action:

1. Handler calls `usage.assertWithinQuota(userId, metric, amount)` which
   compares the current counter against the plan limit.
2. Over quota → `402 PAYMENT_REQUIRED` with `details.recommendedPlan`
   pointing at the next tier.
3. Under quota → handler increments via `usage.increment(...)`.

`GET /v1/billing/usage` returns the current-period summary; the dashboard
Billing screen surfaces it as usage bars.

## Trials

- Paid plans define `trialDays`. During trial, `Subscription.status =
  TRIALING` and the user has full quota.
- The Stripe webhook is authoritative for trial end; we mirror
  `trialEndsAt` locally so the UI can show a countdown.
- On trial expiry Stripe attempts payment. Failure moves us to
  `PAST_DUE` and eventually `CANCELED`.

## Free tier

`FREE` is not a Stripe subscription — it's the absence of any active
subscription. A brand-new user starts here. All quota checks fall back to
the `FREE` plan's `limitsJson` when no active subscription exists.

## Environment matrix

| Env var | Required for | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Any real billing | `sk_test_…` in dev; `sk_live_…` in prod |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Rotate on suspected compromise |
| `STRIPE_PUBLISHABLE_KEY` | Front-end SDK if needed | Optional today |
| `STRIPE_PRICE_CREATOR_MONTHLY` / `_ANNUAL` | Creator checkout | |
| `STRIPE_PRICE_BUSINESS_MONTHLY` / `_ANNUAL` | Business checkout | |
| `STRIPE_CUSTOMER_PORTAL_RETURN_URL` | Portal return URL | Defaults to `WEB_URL/billing` if unset |

## Testing the flow locally

1. Set `STRIPE_SECRET_KEY=sk_test_…` and the `STRIPE_PRICE_*` env vars.
2. Run `stripe listen --forward-to localhost:4000/v1/billing/webhook` and
   copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Trigger the checkout flow from `/pricing` → sign in → upgrade.
4. Use Stripe's test cards (`4242 4242 4242 4242`) — the webhook fires and
   the Subscription row updates.

## Common failure modes

- **Webhook 400 "Invalid signature"** — usually the wrong
  `STRIPE_WEBHOOK_SECRET` for the environment. Regenerate in the Stripe
  dashboard and redeploy.
- **User stuck on FREE after Checkout** — likely webhook delivery failure.
  Check `WebhookDelivery` rows and the Stripe dashboard's webhook logs.
- **`PAST_DUE` doesn't recover after payment succeeds** — confirm the
  `invoice.paid` handler ran; the DB status should return to `ACTIVE`.
