'use client';

/**
 * Client-side Sentry initialisation. Lazy-loaded so browsers without the
 * public DSN configured never fetch the SDK. Import this module once from
 * the root layout via a client component.
 */

import { useEffect } from 'react';

let _initialised = false;

async function ensureSentry(): Promise<void> {
  if (_initialised) return;
  _initialised = true;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/browser');
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'production',
      release: process.env.NEXT_PUBLIC_GIT_SHA,
      tracesSampleRate: 0.05,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
    });
  } catch {
    // SDK not installed — silently skip.
  }
}

export function SentryClientInit() {
  useEffect(() => {
    void ensureSentry();
  }, []);
  return null;
}
