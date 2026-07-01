'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

export default function NewTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('question');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const t = await clientSdk().createTicket({ subject, body, category, priority });
      router.push(`/support/${t.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open ticket');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New ticket</h1>
        <p className="text-sm text-muted-foreground">
          Include steps to reproduce, screenshots, and the project or export id if applicable.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>What can we help with?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm"
                >
                  <option value="question">Question</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature request</option>
                  <option value="billing">Billing</option>
                  <option value="account">Account</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Subject</span>
              <Input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="One-line summary"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Message</span>
              <textarea
                required
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </label>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Submit ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
