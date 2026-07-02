import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

import { Button } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center py-20 md:py-28 text-center max-w-xl mx-auto space-y-6">
          <div
            className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700"
            aria-hidden
          >
            <Search className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              404 · Page not found
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              We couldn&apos;t find that page.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The link might be stale, or the page has moved. Try the studio
              or the homepage — both are working.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/">
              <Button leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back to the homepage
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost">Go to the studio</Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
