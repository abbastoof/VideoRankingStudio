import { serverClient } from '@/lib/sdk';

import { FlagsTable } from '@/components/admin/FlagsTable';

export const dynamic = 'force-dynamic';

interface Flag {
  id: string;
  key: string;
  description: string | null;
  defaultOn: boolean;
  rolloutPercent: number;
  updatedAt: string;
}

export default async function AdminFlagsPage() {
  const sdk = serverClient();
  const data = await sdk.adminListFlags();
  const items = data.items as unknown as Flag[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
        <p className="text-sm text-muted-foreground">
          Toggle features globally or roll them out to a percentage of users.
        </p>
      </header>
      <FlagsTable initial={items} />
    </div>
  );
}
