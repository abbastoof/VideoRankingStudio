import { ArrowUpRight, Users, DollarSign, Activity, Zap } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const sdk = serverClient();
  const metrics = await sdk.adminMetrics();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
        <p className="text-sm text-muted-foreground">Operational metrics across the platform.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total users"
          value={metrics.totalUsers.toLocaleString()}
          hint={`${metrics.activeUsersLast30Days.toLocaleString()} active in the last 30 days`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Monthly recurring revenue"
          value={`$${(metrics.mrrCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          hint={`${metrics.paidUsers.toLocaleString()} paid subscribers`}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Exports (last 24h)"
          value={metrics.exportsLast24h.toLocaleString()}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Job backlog"
          value={metrics.jobBacklog.toLocaleString()}
          hint="Queued + running + retrying"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionLink href="/admin/users" title="Users" description="Search, promote, suspend, revoke sessions" />
        <SectionLink href="/admin/subscriptions" title="Subscriptions" description="Active plans + MRR breakdown" />
        <SectionLink href="/admin/abuse" title="Abuse reports" description="Triage flagged content" />
        <SectionLink href="/admin/tickets" title="Support tickets" description="Answer questions from customers" />
        <SectionLink href="/admin/flags" title="Feature flags" description="Roll out features gradually" />
        <SectionLink href="/admin/audit" title="Audit log" description="Everything that changed, and by whom" />
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function SectionLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface-raised p-4 hover:border-brand-300 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold group-hover:text-brand-700">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-700" />
      </div>
    </Link>
  );
}
