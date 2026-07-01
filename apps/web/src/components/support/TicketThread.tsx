'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, Button, Card, CardContent } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  lastMessageAt: string;
  messages: Message[];
}

export function TicketThread({ initial }: { initial: Ticket }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket>(initial);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().replyTicket(ticket.id, { body: reply });
      const fresh = (await clientSdk().getTicket(ticket.id)) as unknown as Ticket;
      setTicket(fresh);
      setReply('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!confirm('Mark this ticket as resolved?')) return;
    await clientSdk().closeTicket(ticket.id);
    router.refresh();
  }

  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">
            Opened {new Date(ticket.createdAt).toLocaleString()}
            {ticket.category ? ` · ${ticket.category}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={priorityTone(ticket.priority)}>{ticket.priority.toLowerCase()}</Badge>
          <Badge tone={statusTone(ticket.status)}>{ticket.status.toLowerCase().replace('_', ' ')}</Badge>
        </div>
      </header>

      <ul className="space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id}>
            <Card
              className={
                m.authorRole === 'ADMIN' || m.authorRole === 'SUPPORT'
                  ? 'border-brand-200'
                  : ''
              }
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {m.authorName}
                    {m.authorRole !== 'USER' ? (
                      <Badge tone="brand" className="ml-2">
                        {m.authorRole.toLowerCase()}
                      </Badge>
                    ) : null}
                    {m.internal ? (
                      <Badge tone="warning" className="ml-2">
                        internal
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {closed ? (
        <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          This ticket is closed. Open a new one if the issue comes back.
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <textarea
              rows={6}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add a reply…"
              className="w-full rounded-md border border-border bg-surface-raised p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={close}>
                Mark as resolved
              </Button>
              <Button onClick={send} loading={busy} disabled={!reply.trim()}>
                Send reply
              </Button>
            </div>
          </CardContent>
        </Card>
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
