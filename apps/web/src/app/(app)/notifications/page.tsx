import Link from 'next/link';

import { Card, CardContent } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default async function NotificationsPage() {
  const sdk = serverClient();
  const data = await sdk.listNotifications({ limit: 100 });
  const items = data.items as unknown as Notification[];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {(data as unknown as { unreadCount: number }).unreadCount} unread of {items.length}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">You're all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="rounded-lg border border-border bg-surface-raised divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className={n.readAt ? 'opacity-70' : ''}>
              {n.link ? (
                <Link href={n.link} className="block p-4 hover:bg-surface-muted">
                  <NotificationRow n={n} />
                </Link>
              ) : (
                <div className="p-4">
                  <NotificationRow n={n} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ n }: { n: Notification }) {
  return (
    <div className="flex items-start gap-3">
      {!n.readAt ? (
        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
      ) : (
        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${n.readAt ? 'font-normal' : 'font-semibold'}`}>{n.title}</p>
        {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
