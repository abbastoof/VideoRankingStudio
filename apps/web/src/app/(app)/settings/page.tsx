import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vrs/ui';

import { ProfileForm } from '@/components/settings/ProfileForm';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account details, preferences, and security. Changes save immediately.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear inside the editor and on collaborator invites.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              email: session.user.email,
              name: session.user.name ?? '',
              locale: session.user.locale,
              timezone: session.user.timezone,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Sign in uses one-time codes. Active sessions can be revoked from any device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/security"
            className="flex items-center justify-between rounded-md border border-border bg-surface-muted/40 p-3 text-sm hover:border-brand-300 hover:bg-surface-muted"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden />
              Review active sessions, sign out other devices, or delete your account.
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
