import { Check, ExternalLink, Sparkles } from 'lucide-react';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vrs/ui';

import { BillingActions } from '@/components/billing/BillingActions';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const sdk = serverClient();
  const [plans, subscription, usage, invoices] = await Promise.all([
    sdk.listPlans(),
    sdk.getSubscription(),
    sdk.getUsage(),
    sdk.listInvoices(),
  ]);

  const planByCode = new Map(plans.items.map((p) => [p.code, p]));
  const currentPlanCode = subscription?.planCode ?? 'FREE';

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, see usage for this period, and download invoices.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.items
          .filter((p) => p.code !== 'ENTERPRISE')
          .map((plan) => {
            const isCurrent = plan.code === currentPlanCode;
            return (
              <Card
                key={plan.code}
                className={
                  plan.highlight
                    ? 'border-brand-400 ring-1 ring-brand-300'
                    : ''
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight ? (
                      <Badge tone="brand">
                        <Sparkles className="h-3 w-3" /> Most popular
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight">
                      {plan.monthlyPriceCents === 0
                        ? 'Free'
                        : formatPrice(plan.monthlyPriceCents, plan.currency)}
                    </p>
                    {plan.monthlyPriceCents > 0 ? (
                      <p className="text-xs text-muted-foreground">per month, billed monthly</p>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <BillingActions
                    planCode={plan.code as 'FREE' | 'CREATOR' | 'BUSINESS'}
                    current={isCurrent}
                    hasSubscription={Boolean(subscription)}
                  />
                </CardContent>
              </Card>
            );
          })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage this period</CardTitle>
            {subscription ? (
              <CardDescription>
                Resets on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
              </CardDescription>
            ) : (
              <CardDescription>Free plan usage resets on the first of each month.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {usage.items.map((u) => (
              <UsageBar key={u.kind} kind={u.kind} used={u.used} limit={u.limit} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
            <CardDescription>The last 25 invoices on file.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.items.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{inv.number ?? inv.id.slice(0, 12)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString()} ·{' '}
                        {formatPrice(inv.amountCents, inv.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={invoiceTone(inv.status)}>{inv.status.toLowerCase()}</Badge>
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          className="text-sm text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                          rel="noopener"
                          target="_blank"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function invoiceTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'OPEN' || status === 'DRAFT') return 'warning';
  if (status === 'UNCOLLECTIBLE' || status === 'VOID') return 'danger';
  return 'neutral';
}

function UsageBar({ kind, used, limit }: { kind: string; used: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-brand-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{prettyKind(kind)}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatUsageValue(kind, used)} / {unlimited ? 'unlimited' : formatUsageValue(kind, limit)}
        </span>
      </div>
      {!unlimited ? (
        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function prettyKind(k: string): string {
  return k
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUsageValue(kind: string, n: number): string {
  if (kind === 'STORAGE_BYTES') {
    const gb = n / 1_073_741_824;
    return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
  }
  return new Intl.NumberFormat().format(n);
}
