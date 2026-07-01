'use client';

import { ExternalLink, RefreshCw, ThumbsUp, MessageSquare, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Spinner } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Row {
  publishJobId: string;
  projectId: string;
  provider: string;
  providerVideoId: string | null;
  providerUrl: string | null;
  title: string;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  fetchedAt: string | null;
}

export function ExternalStatsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await clientSdk().externalStats();
      setRows(res.items as Row[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function refresh() {
    setRefreshing(true);
    setErr(null);
    try {
      await clientSdk().refreshExternalStats();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + (r.views ?? 0),
      likes: acc.likes + (r.likes ?? 0),
      comments: acc.comments + (r.comments ?? 0),
    }),
    { views: 0, likes: 0, comments: 0 },
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Published performance</h3>
            <p className="text-xs text-muted-foreground">
              Aggregated across every video you've published through VideoRankingStudio.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className={refreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />}
            loading={refreshing}
            onClick={refresh}
          >
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={<Eye className="h-3.5 w-3.5" />} label="Total views" value={totals.views} />
          <StatTile icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Total likes" value={totals.likes} />
          <StatTile icon={<MessageSquare className="h-3.5 w-3.5" />} label="Total comments" value={totals.comments} />
        </div>

        {loading ? (
          <div className="py-6 grid place-items-center">
            <Spinner label="Loading external stats" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No published videos yet. Publish an export to see performance here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.publishJobId} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {r.provider.toLowerCase()}
                    {r.publishedAt ? ` · published ${new Date(r.publishedAt).toLocaleDateString()}` : ''}
                    {r.fetchedAt ? ` · updated ${relative(r.fetchedAt)}` : ' · stats pending'}
                  </p>
                </div>
                <StatCell value={r.views} label="views" />
                <StatCell value={r.likes} label="likes" />
                <StatCell value={r.comments} label="comments" />
                {r.providerUrl ? (
                  <a
                    href={r.providerUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-brand-700 hover:text-brand-800"
                    aria-label="Open"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {err ? <p className="text-xs text-danger">{err}</p> : null}
      </CardContent>
    </Card>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function StatCell({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="text-right shrink-0 w-16">
      <p className="text-sm font-semibold tabular-nums">{value == null ? '—' : formatNumber(value)}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
