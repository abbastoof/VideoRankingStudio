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
          <p className="text-sm text-muted-foreground">
            Session management UI lands with the audit + revoke endpoints — coming
            in the next session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
