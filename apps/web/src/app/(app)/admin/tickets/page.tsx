import Link from 'next/link';

import { Badge } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface TicketRow {
  id: string;
  userEmail: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export default async function AdminTicketsPage() {
  const sdk = serverClient();
  const data = await sdk.adminListTickets();
  const items = data.items as unknown as TicketRow[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support tickets</h1>
          <p className="text-sm text-muted-foreground">
            {items.filter((t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length} open of {items.length}
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand-700 hover:text-brand-800">
          Back to admin
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Priority</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-md">{t.subject}</div>
                    {t.category ? (
                      <div className="text-xs text-muted-foreground">{t.category}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{t.userEmail}</td>
                  <td className="px-4 py-3">
                    <Badge tone={priorityTone(t.priority)}>{t.priority.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(t.status)}>{t.status.toLowerCase().replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.lastMessageAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function priorityTone(priority: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (priority === 'URGENT') return 'danger';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'neutral';
  return 'info';
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success';
  if (status === 'WAITING_SUPPORT') return 'warning';
  if (status === 'WAITING_USER') return 'info';
  return 'neutral';
}
