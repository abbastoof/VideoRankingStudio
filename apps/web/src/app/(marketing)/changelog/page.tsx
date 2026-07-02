import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Button, Card, CardContent } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { changelog, type ChangelogEntry, type ChangelogTag } from '@/content/changelog';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'What we shipped, when we shipped it. VideoRankingStudio product changes across the studio, editor, publishing, and infrastructure.',
};

const tagMeta: Record<
  ChangelogTag,
  { label: string; tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' }
> = {
  new: { label: 'New', tone: 'brand' },
  improved: { label: 'Improved', tone: 'info' },
  fixed: { label: 'Fixed', tone: 'success' },
  security: { label: 'Security', tone: 'warning' },
  infra: { label: 'Infra', tone: 'neutral' },
};

export default function ChangelogPage() {
  const entries = [...changelog].sort((a, b) => (a.date < b.date ? 1 : -1));
  const byMonth = groupByMonth(entries);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="container py-16 md:py-20 max-w-3xl">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Changelog</h1>
            <p className="text-lg text-muted-foreground">
              A running log of the things we shipped. We focus on changes a
              paying creator would notice — new features, improvements to
              existing flows, security work, and public-facing infra.
            </p>
          </div>

          <div className="mt-10 space-y-14">
            {byMonth.map(([month, items]) => (
              <section key={month} className="space-y-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {month}
                </h2>
                <div className="space-y-6">
                  {items.map((entry, idx) => (
                    <EntryCard key={`${entry.date}-${idx}`} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-16 rounded-lg border border-border bg-surface-muted/40 p-6 md:p-8">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Have a change you want to see?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We publish the roadmap next door. If you don&apos;t see the
                thing you need, tell us — creator feedback is how the top of
                the queue gets set.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/roadmap">
                  <Button variant="outline" size="sm">
                    See the roadmap
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="sm">Send feedback</Button>
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

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const meta = tagMeta[entry.tag];
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <time dateTime={entry.date} className="text-xs text-muted-foreground">
            {formatDate(entry.date)}
          </time>
        </div>
        <h3 className="text-base font-semibold tracking-tight">{entry.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
        {entry.items && entry.items.length > 0 ? (
          <ul className="space-y-1.5 pt-1">
            {entry.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground/85">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function groupByMonth(entries: ChangelogEntry[]): [string, ChangelogEntry[]][] {
  const map = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const key = monthLabel(entry.date);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return Array.from(map.entries());
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}
