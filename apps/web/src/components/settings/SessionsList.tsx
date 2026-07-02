'use client';

import { CheckCircle2, Loader2, LogOut, Monitor, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, useConfirm } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface SessionRow {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export function SessionsList({ initial }: { initial: SessionRow[] }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<SessionRow[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAll, setPendingAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function revokeOne(row: SessionRow) {
    if (row.current) {
      const ok = await confirm({
        title: 'Sign out of this device?',
        description:
          "This is the device you're currently using. You'll be returned to sign-in.",
        confirmLabel: 'Sign out',
        tone: 'danger',
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: 'Revoke this session?',
        description:
          "The device will be signed out on its next request — usually within a minute.",
        confirmLabel: 'Revoke session',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setPendingId(row.id);
    setErr(null);
    try {
      await clientSdk().revokeSession(row.id);
      if (row.current) {
        window.location.href = '/signin';
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not revoke that session');
    } finally {
      setPendingId(null);
    }
  }

  async function revokeAll() {
    const ok = await confirm({
      title: 'Sign out of every device?',
      description:
        'Every active session, including this one, will be revoked. You will be returned to sign-in and other devices will be signed out on their next request.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (!ok) return;
    setPendingAll(true);
    setErr(null);
    try {
      await clientSdk().revokeAllSessions();
      // Server clears the session cookies on the response, so the browser
      // no longer has a session — go straight to sign-in.
      window.location.href = '/signin?reason=sessions-revoked';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not revoke sessions');
      setPendingAll(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active sessions — that shouldn&apos;t happen. Refresh the page.
      </p>
    );
  }

  const nonCurrentCount = rows.filter((r) => !r.current).length;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 p-4">
            <div className="mt-0.5 shrink-0 text-muted-foreground">
              <DeviceIcon userAgent={row.userAgent} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {describeDevice(row.userAgent)}
                </p>
                {row.current ? (
                  <Badge tone="success">
                    <CheckCircle2 className="h-3 w-3" /> This device
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {row.ip ? `${row.ip} · ` : ''}
                Last used {formatRelative(row.lastUsedAt)} · Signed in{' '}
                {new Date(row.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(row.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void revokeOne(row)}
              loading={pendingId === row.id}
              leftIcon={row.current ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              aria-label={row.current ? 'Sign out of this device' : 'Revoke this session'}
            >
              {row.current ? 'Sign out' : 'Revoke'}
            </Button>
          </li>
        ))}
      </ul>

      {nonCurrentCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {nonCurrentCount} other {nonCurrentCount === 1 ? 'session' : 'sessions'} beyond
            this device.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void revokeAll()}
            loading={pendingAll}
          >
            {pendingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Revoking…
              </>
            ) : (
              'Sign out of all other devices'
            )}
          </Button>
        </div>
      ) : null}

      {err ? (
        <p className="text-sm text-danger" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

// ─── User-agent helpers ────────────────────────────────────────────────

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const kind = classifyDevice(userAgent);
  if (kind === 'mobile') return <Smartphone className="h-5 w-5" aria-hidden />;
  if (kind === 'tablet') return <Tablet className="h-5 w-5" aria-hidden />;
  return <Monitor className="h-5 w-5" aria-hidden />;
}

function classifyDevice(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile/.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Small hand-rolled parser. We don't need a full library — every UA seen in
 * production hits one of these branches, and misses fall back to "Unknown
 * device" which is honest.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Unknown device';
}

function detectOs(ua: string): string | null {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X (\d+)_?(\d+)?/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

function detectBrowser(ua: string): string | null {
  // Order matters — Edge advertises itself as Chrome too.
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
