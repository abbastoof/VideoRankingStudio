import { ArrowRight, ListOrdered, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@vrs/ui';

import { RankingListCard } from '@/components/rankings/RankingListCard';
import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Video Rankings' };

interface PageProps {
  searchParams: { cursor?: string };
}

export default async function RankingsIndexPage({ searchParams }: PageProps) {
  const sdk = serverClient();
  const data = await sdk.listProjects({
    type: 'RANKING',
    cursor: searchParams.cursor,
    limit: 24,
    sortBy: 'lastEditedAt',
    sortDir: 'desc',
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Video Rankings</h1>
          <p className="text-sm text-muted-foreground">
            Top-10 style videos built from ranked clips.
          </p>
        </div>
        <Link href="/rankings/new">
          <Button leftIcon={<Plus className="h-4 w-4" />}>New Video Ranking</Button>
        </Link>
      </header>

      {data.items.length === 0 ? (
        <div className="grid place-items-center rounded-lg border-2 border-dashed border-border px-6 py-16 text-center">
          <div className="space-y-3">
            <ListOrdered className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No rankings yet</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Paste a few TikTok, Instagram, or YouTube links, arrange the order, and generate a
              ready-to-post countdown video.
            </p>
            <Link href="/rankings/new" className="inline-block">
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Create your first ranking
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((project) => (
            <RankingListCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {data.nextCursor ? (
        <div className="flex justify-center">
          <Link href={{ pathname: '/rankings', query: { cursor: data.nextCursor } }}>
            <Button variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Load more
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
