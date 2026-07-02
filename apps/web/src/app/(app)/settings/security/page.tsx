import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vrs/ui';

import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';
import { SessionsList } from '@/components/settings/SessionsList';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Active sessions and account controls.',
};

interface RawSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export default async function SecuritySettingsPage() {
  const sdk = serverClient();
  const res = await sdk.listSessions();
  const sessions = (res.items as unknown as RawSession[]) ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>{' '}
          / <span className="text-foreground">Security</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Review the devices signed in to your account. Revoke anything you don&apos;t
          recognize.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            One row per browser or device with a live session. Revoking a session
            signs it out immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList initial={sessions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanent. All projects, exports, transcripts, and voiceovers will be
            removed after a 30-day grace period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountCard />
        </CardContent>
      </Card>
    </div>
  );
}
