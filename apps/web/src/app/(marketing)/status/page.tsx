import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge, Card, CardContent } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { serverClient } from '@/lib/sdk';

export const metadata: Metadata = {
  title: 'System status',
  description:
    'Live operational status for VideoRankingStudio — API, database, and job queue.',
};

// Never cache — this is a real-time signal, not a marketing snapshot.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Overall = 'operational' | 'degraded' | 'down' | 'unknown';

interface Component {
  key: string;
  label: string;
  status: 'operational' | 'degraded' | 'down';
  latencyMs?: number;
}

interface StatusResponse {
  status: Overall;
  updatedAt: string;
  components: Component[];
}

async function loadStatus(): Promise<StatusResponse> {
  try {
    const res = await serverClient().getPublicStatus();
    return res as StatusResponse;
  } catch {
    // API itself is unreachable. Surface that honestly instead of guessing
    // at component-level state we can't observe.
    return {
      status: 'unknown',
      updatedAt: new Date().toISOString(),
      components: [],
    };
  }
}

export default async function StatusPage() {
  const snapshot = await loadStatus();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="container py-16 md:py-20 max-w-3xl">
          <div className="space-y-8">
            <OverallCard status={snapshot.status} updatedAt={snapshot.updatedAt} />

            {snapshot.components.length > 0 ? (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {snapshot.components.map((c) => (
                    <ComponentRow key={c.key} component={c} />
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="p-6 space-y-3">
                <h2 className="text-base font-semibold">How this page works</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Each check is live, refreshed the moment you load this page.
                  Green means the component answered a health probe within
                  budget. Amber means it&apos;s answering but slow or partially
                  degraded. Red means it did not respond.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A full incident history and per-region breakdowns will land
                  as we complete our observability build-out. In the meantime,
                  if you&apos;re seeing something odd,{' '}
                  <Link href="/contact?topic=support" className="text-brand-600 underline underline-offset-4 hover:text-brand-700">
                    tell us
                  </Link>{' '}
                  and we&apos;ll dig in.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function OverallCard({ status, updatedAt }: { status: Overall; updatedAt: string }) {
  const meta = overallMeta(status);
  return (
    <div
      className={`rounded-lg border p-6 md:p-8 ${meta.wrapClass}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${meta.iconBg}`}
          aria-hidden
        >
          {meta.icon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{meta.title}</h1>
            <Badge tone={meta.tone}>{meta.badgeLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{meta.detail}</p>
          <p className="text-xs text-muted-foreground pt-1">
            Last checked{' '}
            <time dateTime={updatedAt}>{formatTime(updatedAt)}</time>
          </p>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ component }: { component: Component }) {
  const meta = statusMeta(component.status);
  return (
    <div className="flex items-center gap-4 p-4 md:p-5">
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.iconBg}`}
        aria-hidden
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{component.label}</p>
        <p className="text-xs text-muted-foreground">{meta.label}</p>
      </div>
      {typeof component.latencyMs === 'number' ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {component.latencyMs} ms
        </span>
      ) : null}
    </div>
  );
}

function overallMeta(status: Overall): {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  badgeLabel: string;
  wrapClass: string;
  iconBg: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'operational':
      return {
        title: 'All systems operational',
        detail: 'Every component is answering health probes within expected budgets.',
        tone: 'success',
        badgeLabel: 'Operational',
        wrapClass: 'border-success/30 bg-success/5',
        iconBg: 'bg-success/15 text-success',
        icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
      };
    case 'degraded':
      return {
        title: 'Partial degradation',
        detail: 'At least one component is answering slowly. Core flows should still work.',
        tone: 'warning',
        badgeLabel: 'Degraded',
        wrapClass: 'border-warning/30 bg-warning/5',
        iconBg: 'bg-warning/15 text-warning',
        icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
      };
    case 'down':
      return {
        title: 'Service disruption',
        detail: 'One or more critical components are not responding. We are looking at it.',
        tone: 'danger',
        badgeLabel: 'Down',
        wrapClass: 'border-danger/30 bg-danger/5',
        iconBg: 'bg-danger/15 text-danger',
        icon: <AlertCircle className="h-5 w-5" aria-hidden />,
      };
    default:
      return {
        title: 'Status unavailable',
        detail: 'We could not reach the status endpoint. That may mean the API itself is offline.',
        tone: 'neutral',
        badgeLabel: 'Unknown',
        wrapClass: 'border-border bg-surface-muted/40',
        iconBg: 'bg-surface-muted text-muted-foreground',
        icon: <AlertCircle className="h-5 w-5" aria-hidden />,
      };
  }
}

function statusMeta(status: Component['status']): {
  label: string;
  iconBg: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'operational':
      return {
        label: 'Operational',
        iconBg: 'bg-success/15 text-success',
        icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
      };
    case 'degraded':
      return {
        label: 'Degraded performance',
        iconBg: 'bg-warning/15 text-warning',
        icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      };
    case 'down':
      return {
        label: 'Not responding',
        iconBg: 'bg-danger/15 text-danger',
        icon: <AlertCircle className="h-4 w-4" aria-hidden />,
      };
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
