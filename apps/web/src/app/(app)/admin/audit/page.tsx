import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { actorId?: string; action?: string; cursor?: string };
}) {
  const sdk = serverClient();
  const data = await sdk.adminAuditLog({
    actorId: searchParams.actorId,
    action: searchParams.action,
    cursor: searchParams.cursor,
    limit: 100,
  });
  const items = data.items as unknown as AuditRow[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Everything that changed, and by whom. Filter by actor or action prefix.
        </p>
      </header>

      <form action="/admin/audit" className="flex gap-2">
        <input
          name="actorId"
          placeholder="Actor id"
          defaultValue={searchParams.actorId ?? ''}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm w-64"
        />
        <input
          name="action"
          placeholder="Action prefix e.g. billing."
          defaultValue={searchParams.action ?? ''}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm w-64"
        />
        <button className="h-10 rounded-md bg-brand-500 px-4 text-sm font-medium text-brand-foreground">
          Filter
        </button>
      </form>

      <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">When</th>
              <th className="px-4 py-2 text-left">Action</th>
              <th className="px-4 py-2 text-left">Actor</th>
              <th className="px-4 py-2 text-left">Target</th>
              <th className="px-4 py-2 text-left">IP</th>
              <th className="px-4 py-2 text-left">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.actorId?.slice(0, 12) ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {r.targetType ? `${r.targetType}:${r.targetId?.slice(0, 12)}` : '—'}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.ip ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground max-w-md truncate">
                  {Object.keys(r.meta).length > 0 ? JSON.stringify(r.meta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
