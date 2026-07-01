import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface PublishJob {
  id: string;
  exportId: string;
  projectId: string;
  provider: string;
  targetDisplayName: string | null;
  status: string;
  providerVideoId: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  metadata: { title?: string; privacy?: string };
  publishedAt: string | null;
  createdAt: string;
}

export default async function PublishHistoryPage() {
  const sdk = serverClient();
  const data = await sdk.listPublishJobs();
  const items = data.items as unknown as PublishJob[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Publish history</h1>
          <p className="text-sm text-muted-foreground">
            Every push to a connected platform. Failed jobs can be re-published from the export.
          </p>
        </div>
        <Link href="/settings/publishing" className="text-sm text-brand-700 hover:text-brand-800">
          Manage connections →
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-10 text-center">
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Platform</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Requested</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-xs">{j.metadata.title ?? 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">
                      {j.metadata.privacy ?? 'privacy: —'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="capitalize">{j.provider.toLowerCase()}</p>
                    {j.targetDisplayName ? (
                      <p className="text-xs text-muted-foreground truncate">{j.targetDisplayName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(j.status)}>{j.status.toLowerCase()}</Badge>
                    {j.errorMessage ? (
                      <p className="mt-1 text-xs text-danger max-w-xs truncate">{j.errorMessage}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {j.providerUrl ? (
                      <a
                        href={j.providerUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        href={`/projects/${j.projectId}/exports/${j.exportId}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        View export
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (s === 'PUBLISHED') return 'success';
  if (s === 'PUBLISHING') return 'info';
  if (s === 'QUEUED') return 'warning';
  if (s === 'FAILED') return 'danger';
  return 'neutral';
}
