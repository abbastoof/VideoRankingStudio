import { Plus } from 'lucide-react';
import Link from 'next/link';

import { Badge, Card, CardContent } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export default async function SupportPage() {
  const sdk = serverClient();
  const data = await sdk.listTickets();
  const items = data.items as unknown as Ticket[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">
            Ask a question, report a bug, or request a feature. We answer during business hours.
          </p>
        </div>
        <Link
          href="/support/new"
          className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> New ticket
        </Link>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <h3 className="font-semibold">No tickets yet</h3>
            <p className="text-sm text-muted-foreground">
              Everything's smooth so far — we'll show your conversations here when you open one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface-raised overflow-hidden">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/${t.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(t.lastMessageAt).toLocaleString()}
                    {t.category ? ` · ${t.category}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={priorityTone(t.priority)}>{t.priority.toLowerCase()}</Badge>
                  <Badge tone={statusTone(t.status)}>{t.status.toLowerCase().replace('_', ' ')}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function priorityTone(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'URGENT') return 'danger';
  if (p === 'HIGH') return 'warning';
  if (p === 'LOW') return 'neutral';
  return 'info';
}

function statusTone(s: string): 'success' | 'warning' | 'info' | 'neutral' {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'success';
  if (s === 'WAITING_SUPPORT') return 'warning';
  if (s === 'WAITING_USER') return 'info';
  return 'neutral';
}
