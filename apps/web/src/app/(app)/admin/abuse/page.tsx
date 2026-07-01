import { Badge } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface AbuseRow {
  id: string;
  reporterEmail: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export default async function AdminAbusePage() {
  const sdk = serverClient();
  const data = await sdk.adminListAbuseReports();
  const items = data.items as unknown as AbuseRow[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Abuse reports</h1>
        <p className="text-sm text-muted-foreground">
          Content flagged for review — take action or dismiss.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Queue is empty.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface-raised p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{r.reason.toLowerCase().replace('_', ' ')}</Badge>
                  <Badge tone={statusTone(r.status)}>{r.status.toLowerCase().replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {r.targetType}:{r.targetId.slice(0, 12)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Reporter: {r.reporterEmail ?? 'anonymous'}
              </div>
              {r.description ? (
                <p className="text-sm whitespace-pre-wrap">{r.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTION_TAKEN') return 'success';
  if (status === 'REVIEWING') return 'info' as never;
  if (status === 'DISMISSED') return 'neutral';
  return 'warning';
}
