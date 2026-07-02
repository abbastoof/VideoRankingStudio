import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Compass, Hammer } from 'lucide-react';

import { Badge, Button, Card, CardContent } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { roadmap, type RoadmapColumn, type RoadmapItem } from '@/content/roadmap';

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'What we are exploring, actively building, and have already shipped at VideoRankingStudio.',
};

const columnMeta: Record<
  RoadmapColumn,
  { title: string; description: string; icon: React.ReactNode; tone: 'brand' | 'info' | 'success' }
> = {
  discovery: {
    title: 'In discovery',
    description: 'We are shaping the problem. Feedback here changes the outcome the most.',
    icon: <Compass className="h-4 w-4" aria-hidden />,
    tone: 'info',
  },
  building: {
    title: 'Building',
    description: 'Someone is actively on it. Expect it in a future changelog entry.',
    icon: <Hammer className="h-4 w-4" aria-hidden />,
    tone: 'brand',
  },
  shipped: {
    title: 'Recently shipped',
    description: 'Already in production and in the changelog. Kept here for context.',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    tone: 'success',
  },
};

const columnOrder: RoadmapColumn[] = ['discovery', 'building', 'shipped'];

export default function RoadmapPage() {
  const grouped: Record<RoadmapColumn, RoadmapItem[]> = {
    discovery: [],
    building: [],
    shipped: [],
  };
  for (const item of roadmap) grouped[item.column].push(item);
  // Shipped: newest first.
  grouped.shipped.sort((a, b) => (a.shippedOn ?? '') < (b.shippedOn ?? '') ? 1 : -1);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="container py-16 md:py-20">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Roadmap</h1>
            <p className="text-lg text-muted-foreground">
              We publish the roadmap so you know what we&apos;re optimising
              for. Items in discovery need your input the most — tell us what
              would make the difference for your workflow.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {columnOrder.map((column) => (
              <RoadmapCol key={column} column={column} items={grouped[column]} />
            ))}
          </div>

          <div className="mt-16 rounded-lg border border-border bg-surface-muted/40 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-center">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Vote with your use case.</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The order of this list is set by creator feedback and the
                  problems we see in the wild. Tell us what&apos;s in the way
                  of your next weekly post and we&apos;ll wire it in.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link href="/contact?topic=general">
                  <Button>Share what you need</Button>
                </Link>
                <Link href="/changelog">
                  <Button variant="ghost">See what shipped</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function RoadmapCol({ column, items }: { column: RoadmapColumn; items: RoadmapItem[] }) {
  const meta = columnMeta[column];
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-muted text-foreground"
          aria-hidden
        >
          {meta.icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
            Nothing here right now.
          </p>
        ) : (
          items.map((item) => <ItemCard key={item.title} item={item} tone={meta.tone} />)
        )}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  tone,
}: {
  item: RoadmapItem;
  tone: 'brand' | 'info' | 'success';
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>
            {item.column === 'shipped' && item.shippedOn ? formatShipped(item.shippedOn) : columnLabel(item.column)}
          </Badge>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.outcome}</p>
      </CardContent>
    </Card>
  );
}

function columnLabel(column: RoadmapColumn): string {
  if (column === 'discovery') return 'Discovery';
  if (column === 'building') return 'In progress';
  return 'Shipped';
}

function formatShipped(iso: string): string {
  const d = new Date(iso);
  return `Shipped ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d)}`;
}
