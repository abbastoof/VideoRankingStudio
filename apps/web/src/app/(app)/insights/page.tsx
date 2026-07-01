import { BarChart3, Clock, FileVideo, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@vrs/ui';

import { ExternalStatsPanel } from '@/components/insights/ExternalStatsPanel';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { range?: string };
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const days = Number(searchParams.range ?? 30);
  const sdk = serverClient();
  const overview = await sdk.insightsOverview(days);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Your production over the last {overview.rangeDays} days.
          </p>
        </div>
        <form action="/insights" className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="submit"
              name="range"
              value={d}
              className={`rounded-md px-3 py-1.5 text-sm border ${
                days === d ? 'bg-brand-500 text-brand-foreground border-brand-500' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FileVideo className="h-4 w-4" />} label="Projects created" value={overview.projectCount.toString()} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Exports finished" value={overview.exportCount.toString()} />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Median render time"
          value={overview.avgExportSeconds ? `${Math.round(overview.avgExportSeconds)}s` : '—'}
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="AI jobs"
          value={overview.aiJobsByKind.reduce((a, b) => a + b.count, 0).toString()}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Exports over time</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={overview.exportsByDay} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI jobs by kind</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={overview.aiJobsByKind.map((k) => ({ label: prettyKind(k.kind), value: k.count }))} />
          </CardContent>
        </Card>
      </section>

      <section>
        <ExternalStatsPanel />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Most exported projects</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.topProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exports in this window.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.topProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <a href={`/projects/${p.id}`} className="hover:text-brand-700">
                      {p.title}
                    </a>
                    <span className="tabular-nums text-muted-foreground">{p.exports}</span>
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

function prettyKind(kind: string): string {
  return kind.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function BarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
          <div
            className="w-full rounded-sm bg-brand-400 hover:bg-brand-500 transition-colors"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
          <span className="text-[10px] text-muted-foreground truncate">{d.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between text-xs mb-0.5">
            <span>{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
