'use client';

/**
 * Client-side Sentry initialisation. Lazy-loaded so browsers without the
 * public DSN configured never fetch the SDK. Import this module once from
 * the root layout via a client component.
 */

import { useEffect } from 'react';

let _initialised = false;

// @sentry/browser is an optional runtime dependency — a build that doesn't
// need error reporting shouldn't fail to typecheck because the package
// isn't installed. The dynamic string import hides the specifier from the
// TS module resolver; at runtime the import either succeeds (SDK present)
// or is caught and skipped.
interface SentryModule {
  init: (opts: {
    dsn: string;
    environment: string;
    release?: string;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
  }) => void;
}

async function ensureSentry(): Promise<void> {
  if (_initialised) return;
  _initialised = true;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const spec = '@sentry/browser';
    const Sentry = (await import(/* webpackIgnore: true */ spec)) as SentryModule;
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
