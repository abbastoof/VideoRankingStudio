import { CheckCircle2, Link2, Youtube } from 'lucide-react';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vrs/ui';

import { PublishingActions } from '@/components/settings/PublishingActions';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface Target {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string | null;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
}

interface PageProps {
  searchParams: { connected?: string };
}

export default async function PublishingSettingsPage({ searchParams }: PageProps) {
  const sdk = serverClient();
  const targets = (await sdk.listPublishTargets()).items as unknown as Target[];

  const byProvider = new Map(targets.map((t) => [t.provider, t]));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Publishing</h1>
        <p className="text-sm text-muted-foreground">
          Connect the platforms where your shorts go live. We only store the
          scopes needed to upload — you can disconnect at any time.
        </p>
      </header>

      {searchParams.connected ? (
        <div className="rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Connected to {searchParams.connected}.
        </div>
      ) : null}

      <div className="grid gap-4">
        <ProviderCard
          provider="YOUTUBE"
          name="YouTube"
          description="Upload finished shorts to your channel. Requires the YouTube Data API upload scope."
          icon={<Youtube className="h-5 w-5 text-red-600" />}
          existing={byProvider.get('YOUTUBE') ?? null}
        />
        <ProviderCard
          provider="TIKTOK"
          name="TikTok"
          description="Push videos to your account via the Content Posting API."
          icon={<TikTokIcon className="h-5 w-5" />}
          existing={byProvider.get('TIKTOK') ?? null}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        We never post without an explicit action — every publish job requires
        you to confirm the title, privacy setting, and target.
      </p>
    </div>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M15.5 3v10.7a3.8 3.8 0 1 1-3.8-3.8v3.3a.9.9 0 1 0 .9.9V3h2.9zM20 8.4a5.6 5.6 0 0 1-3.8-1.5V4a4.6 4.6 0 0 0 3.8 3.4v1z" />
    </svg>
  );
}

function ProviderCard({
  provider,
  name,
  description,
  icon,
  existing,
}: {
  provider: 'YOUTUBE' | 'TIKTOK';
  name: string;
  description: string;
  icon: React.ReactNode;
  existing: Target | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-surface-muted grid place-items-center">
              {icon}
            </div>
            <div>
              <CardTitle>{name}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {existing ? <Badge tone="success">Connected</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm">
          {existing ? (
            <>
              <p className="font-medium">{existing.displayName ?? existing.providerAccountId}</p>
              <p className="text-xs text-muted-foreground">
                Connected {new Date(existing.createdAt).toLocaleDateString()}
                {existing.expiresAt ? ` · Token renews ${new Date(existing.expiresAt).toLocaleDateString()}` : ''}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground flex items-center gap-1">
              <Link2 className="h-4 w-4" /> Not connected
            </p>
          )}
        </div>
        <PublishingActions provider={provider} existingId={existing?.id ?? null} />
      </CardContent>
    </Card>
  );
}
