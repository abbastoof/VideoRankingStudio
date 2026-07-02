import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free while you experiment, scales with production. Fair per-month pricing, cancel in one click.',
};

interface PlanRow {
  code: 'FREE' | 'CREATOR' | 'BUSINESS' | 'ENTERPRISE';
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  annualPriceCents: number;
  currency: string;
  trialDays: number;
  features: string[];
  highlight: boolean;
}

export default async function PricingPage() {
  const sdk = serverClient();
  let plans: PlanRow[] = [];
  try {
    const res = await sdk.listPlans();
    plans = res.items as unknown as PlanRow[];
  } catch {
    plans = [];
  }
  const visiblePlans = plans.filter((p) => p.code !== 'ENTERPRISE');
  const enterprise = plans.find((p) => p.code === 'ENTERPRISE');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="container py-16 md:py-24 space-y-4 max-w-3xl text-center">
          <Badge tone="brand" className="mx-auto">
            <Sparkles className="h-3.5 w-3.5" /> Simple, predictable pricing
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Free to try. Fair as you grow.
          </h1>
          <p className="text-lg text-muted-foreground">
            Every plan includes auto-captions, AI voiceover, and no watermark upgrades outside
            the Free tier. Cancel in one click — anytime.
          </p>
        </section>

        <section className="container pb-20">
          <div className="grid gap-6 md:grid-cols-3">
            {visiblePlans.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted-foreground">
                Pricing details will appear once the billing catalog is synced.
              </p>
            ) : (
              visiblePlans.map((plan) => (
                <PlanCard key={plan.code} plan={plan} />
              ))
            )}
          </div>
        </section>

        {enterprise ? (
          <section className="container pb-20">
            <Card>
              <CardContent className="p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1 space-y-2">
                  <h2 className="text-xl font-semibold">Enterprise</h2>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Custom volume, SSO/SCIM, dedicated GPU capacity, SLA-backed uptime, and
                    tailored legal terms. Talk to us about your team's requirements.
                  </p>
                </div>
                <Link href="/contact?topic=enterprise">
                  <Button size="lg">Talk to sales</Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="border-t border-border bg-surface-muted/40">
          <div className="container py-16 md:py-20 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing hidden. If it isn't answered here, email us and we'll add it.
              </p>
            </div>
            <div className="space-y-6">
              <Faq
                q="Can I cancel any time?"
                a="Yes. One click in Settings → Billing schedules the cancel at the end of the current period. You keep full access until then; nothing auto-renews after."
              />
              <Faq
                q="What happens if I go over a limit?"
                a="We warn you before you hit a quota and never charge overage without your consent. Extra generations wait for the next period or an upgrade — no surprise bills."
              />
              <Faq
                q="Do I own the videos I make?"
                a="Yes. Every export, transcript, and voiceover is yours. We license only what we need to run the pipeline on your behalf, and never train on your content."
              />
              <Faq
                q="Which AI providers do you use?"
                a="Configurable per environment. We integrate with providers you'd expect (Anthropic, OpenAI, ElevenLabs, Stability, Runway, Whisper); each capability is provider-swappable so we can move you to a better model when one lands."
              />
              <Faq
                q="Is there a free trial for paid plans?"
                a="Creator and Business come with a 7-day trial. If you cancel during the trial you're never charged."
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const isFree = plan.code === 'FREE';
  const monthly = plan.monthlyPriceCents;
  return (
    <Card className={plan.highlight ? 'border-brand-400 ring-1 ring-brand-300' : ''}>
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
      <CardContent className="space-y-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            {isFree ? 'Free' : formatPrice(monthly, plan.currency)}
          </p>
          {!isFree ? (
            <p className="text-xs text-muted-foreground">per month, billed monthly</p>
          ) : (
            <p className="text-xs text-muted-foreground">Forever, no card required</p>
          )}
          {!isFree && plan.trialDays > 0 ? (
            <p className="text-xs text-muted-foreground">
              Includes a {plan.trialDays}-day free trial.
            </p>
          ) : null}
        </div>
        <ul className="space-y-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Link
          href={isFree ? '/signin?intent=signup' : `/signin?intent=signup&plan=${plan.code}`}
          className="block"
        >
          <Button fullWidth variant={plan.highlight ? 'primary' : 'outline'}>
            {isFree ? 'Get started free' : `Start ${plan.name} trial`}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-md border border-border bg-background p-4">
      <summary className="cursor-pointer list-none font-medium text-sm flex justify-between items-center">
        {q}
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
