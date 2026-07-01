import Link from 'next/link';

import { Badge } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  userId: string;
  userEmail: string;
  planCode: string;
  status: string;
  interval: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  mrrCents: number;
}

export default async function AdminSubscriptionsPage() {
  const sdk = serverClient();
  const data = await sdk.adminListSubscriptions();
  const items = data.items as unknown as Row[];
  const totalMrr = items.reduce((sum, r) => sum + (r.status === 'ACTIVE' || r.status === 'TRIALING' ? r.mrrCents : 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} rows · running MRR ${(totalMrr / 100).toLocaleString()}
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand-700 hover:text-brand-800">
          Back to admin
        </Link>
      </header>

      <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Customer</th>
              <th className="px-4 py-2 text-left">Plan</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Interval</th>
              <th className="px-4 py-2 text-left">Period end</th>
              <th className="px-4 py-2 text-right">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${s.userId}`} className="hover:text-brand-700">
                    {s.userEmail}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{s.planCode.toLowerCase()}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(s.status)}>{s.status.toLowerCase()}</Badge>
                  {s.cancelAtPeriodEnd ? (
                    <Badge tone="warning" className="ml-1">
                      cancel scheduled
                    </Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3 lowercase">{s.interval}</td>
                <td className="px-4 py-3 text-xs">{new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">${(s.mrrCents / 100).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'TRIALING') return 'info';
  if (status === 'PAST_DUE' || status === 'UNPAID') return 'warning';
  if (status === 'CANCELED' || status === 'INCOMPLETE_EXPIRED') return 'danger';
  return 'neutral';
}
