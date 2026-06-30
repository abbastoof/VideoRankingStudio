import { ArrowRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';

import { Badge, Button, Card, CardContent } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { search?: string; status?: string; cursor?: string };
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const sdk = serverClient();
  const data = await sdk.listProjects({
    search: searchParams.search,
    status: searchParams.status as never,
    cursor: searchParams.cursor,
    limit: 24,
    sortBy: 'lastEditedAt',
    sortDir: 'desc',
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {data.items.length} project{data.items.length === 1 ? '' : 's'}
            {searchParams.search ? ` matching "${searchParams.search}"` : ''}
          </p>
        </div>
        <Link href="/projects/new">
          <Button leftIcon={<Plus className="h-4 w-4" />}>New project</Button>
        </Link>
      </header>

      <form className="flex items-center gap-2" action="/projects" method="GET">
        <div className="flex flex-1 items-center gap-2 h-10 rounded-md border border-border bg-surface-raised px-3 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            name="search"
            placeholder="Search by title"
            defaultValue={searchParams.search ?? ''}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Button type="submit" variant="ghost" size="sm">
          Search
        </Button>
      </form>

      {data.items.length === 0 ? (
        <EmptyState search={searchParams.search} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {data.nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={{
              pathname: '/projects',
              query: { ...searchParams, cursor: data.nextCursor },
            }}
          >
            <Button variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Load more
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ search }: { search?: string }) {
  return (
    <Card>
      <CardContent className="p-10 text-center space-y-3">
        <h3 className="text-lg font-semibold">
          {search ? 'No matches' : 'Your projects will live here'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {search
            ? `Try a different search term, or clear the filter to see everything.`
            : `Start by importing a video, dropping in a file, or picking a template. Drafts stay private to you.`}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          {search ? (
            <Link href="/projects">
              <Button variant="ghost">Clear search</Button>
            </Link>
          ) : (
            <Link href="/projects/new">
              <Button>Start your first project</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectCard({
  project,
}: {
  project: {
    id: string;
    title: string;
    status: string;
    type: string;
    aspectRatio: string;
    durationMs: number;
    thumbnailUrl: string | null;
    pinned: boolean;
    lastEditedAt: string;
  };
}) {
  const tone = statusTone(project.status);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="rounded-lg border border-border bg-surface-raised overflow-hidden group hover:border-brand-300 transition-colors"
    >
      <div className="aspect-video bg-gradient-to-br from-brand-200/40 to-brand-500/40 relative">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge tone="neutral">{formatAspect(project.aspectRatio)}</Badge>
          {project.pinned ? <Badge tone="brand">Pinned</Badge> : null}
        </div>
        <div className="absolute bottom-2 right-2">
          <Badge tone={tone}>{prettyStatus(project.status)}</Badge>
        </div>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-sm font-semibold truncate group-hover:text-brand-700">
          {project.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatDuration(project.durationMs)} · edited {formatRelative(project.lastEditedAt)}
        </p>
      </div>
    </Link>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (status) {
    case 'READY': return 'success';
    case 'PROCESSING': return 'info';
    case 'ERROR': return 'danger';
    case 'ARCHIVED': return 'neutral';
    default: return 'warning';
  }
}

function prettyStatus(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatAspect(a: string): string {
  return a.replace(/^R/, '').replace('_', ':');
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
