'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@vrs/ui';

/**
 * Global error boundary. Fires for any unhandled render or data-fetching
 * error under the root layout. Kept intentionally lean: no site chrome,
 * no Sentry pinging by hand (the SentryClientInit in the root layout
 * already reports), just a clear recovery path.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('app.error_boundary', { message: error.message, digest: error.digest });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger"
          aria-hidden
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Something went wrong
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            We hit an unexpected error.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We&apos;ve logged the details. Try again — most transient issues
            clear on retry. If it keeps happening,{' '}
            <Link
              href="/contact?topic=support"
              className="text-brand-600 underline underline-offset-4 hover:text-brand-700"
            >
              let us know
            </Link>
            .
          </p>
          {error.digest ? (
            <p className="pt-2 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
            Try again
          </Button>
          <Link href="/">
            <Button variant="ghost">Back to homepage</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
