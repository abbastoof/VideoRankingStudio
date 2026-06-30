import { Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Badge, Card, CardContent } from '@vrs/ui';

import { serverClient } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { category?: string };
}

export default async function TemplatesPage({ searchParams }: PageProps) {
  const sdk = serverClient();
  const data = await sdk.listTemplates({
    category: searchParams.category,
    limit: 48,
    sortBy: 'popularity',
  });

  const categories = Array.from(new Set(data.items.map((t) => t.category))).sort();

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Format blueprints with pre-tuned scripts, layouts, and caption styles. Pick one to bootstrap a new project.
        </p>
      </header>

      <nav aria-label="Categories" className="flex flex-wrap gap-2">
        <Link
          href="/templates"
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            !searchParams.category
              ? 'bg-brand-500 text-brand-foreground'
              : 'bg-surface-muted hover:bg-surface-raised text-muted-foreground'
          }`}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat}
            href={{ pathname: '/templates', query: { category: cat } }}
            className={`rounded-full px-3 py-1 text-sm transition-colors capitalize ${
              searchParams.category === cat
                ? 'bg-brand-500 text-brand-foreground'
                : 'bg-surface-muted hover:bg-surface-raised text-muted-foreground'
            }`}
          >
            {cat}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="font-semibold">No templates here yet</h3>
            <p className="text-sm text-muted-foreground">
              {searchParams.category
                ? `Nothing under "${searchParams.category}". Try another category.`
                : 'New templates ship most weeks.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((t) => (
            <Link
              key={t.id}
              href={`/projects/new?template=${t.slug}`}
              className="rounded-lg border border-border bg-surface-raised overflow-hidden hover:border-brand-300 transition-colors group"
            >
              <div className="aspect-video bg-gradient-to-br from-brand-200/60 via-brand-400/40 to-brand-600/40 relative">
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
                <div className="absolute top-2 left-2 capitalize">
                  <Badge tone="neutral">{t.category}</Badge>
                </div>
                {t.requiredPlan !== 'FREE' ? (
                  <div className="absolute top-2 right-2">
                    <Badge tone="brand">{t.requiredPlan.toLowerCase()}</Badge>
                  </div>
                ) : null}
              </div>
              <div className="p-4 space-y-1">
                <h3 className="text-sm font-semibold group-hover:text-brand-700">{t.title}</h3>
                {t.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
