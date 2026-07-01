'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await clientSdk().listNotifications({ limit: 20 });
      setItems(res.items as Notification[]);
      setUnread(res.unreadCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function markAllRead() {
    await clientSdk().markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await clientSdk().markNotificationsRead([id]);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((c) => Math.max(0, c - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-danger-foreground text-[10px] font-semibold grid place-items-center"
            aria-hidden
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-80 rounded-lg border border-border bg-surface-raised shadow-floating overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const Row = (
                    <div className="w-full text-left px-3 py-2.5 hover:bg-surface-muted focus:outline-none focus:bg-surface-muted">
                      <div className="flex items-start gap-2">
                        {!n.readAt ? (
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                          />
                        ) : (
                          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-sm truncate',
                              !n.readAt ? 'font-semibold' : 'font-normal',
                            )}
                          >
                            {n.title}
                          </p>
                          {n.body ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {n.body}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatRelative(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => void markOneRead(n.id)}
                          className="block"
                        >
                          {Row}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markOneRead(n.id)}
                          className="block w-full"
                        >
                          {Row}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-3 py-2 text-center">
            <Link
              href="/notifications"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
