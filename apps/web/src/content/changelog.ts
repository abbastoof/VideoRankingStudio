/**
 * Public changelog entries. Newest first.
 *
 * Rules of thumb for what belongs here:
 *  - It's user-facing (a page, a flow, a keyboard shortcut) OR
 *  - It changes a promise we make to users (security, billing, privacy).
 *
 * Refactors, internal renames, and infra work that nobody sees stay out.
 * If in doubt, ask "would a paying creator notice or care?"
 */

export type ChangelogTag = 'new' | 'improved' | 'fixed' | 'security' | 'infra';

export interface ChangelogEntry {
  date: string; // ISO date, YYYY-MM-DD
  title: string;
  tag: ChangelogTag;
  summary: string;
  items?: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: '2026-07-02',
    title: 'Live status page and public contact form',
    tag: 'new',
    summary:
      'You can now check operational health at /status and reach the team through a first-class contact page. Both are wired to the real API — nothing static.',
    items: [
      'Status page reads live component health (API, database, queue).',
      'Contact form validates client- and server-side, supports topic routing, and rate-limits per IP.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Mobile navigation and desktop-recommended editor gate',
    tag: 'new',
    summary:
      'The authenticated app is usable on phones. The editor gates gracefully on small viewports rather than trying to shrink into an unusable state.',
    items: [
      'Slide-in drawer nav mirroring the desktop sidebar, with focus trap and safe-area padding.',
      'Below 1024px the project editor shows a clear "designed for desktop" screen with routes back to your work.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Session management and self-service account deletion',
    tag: 'security',
    summary:
      'You can see every active session for your account, sign out of individual devices, sign out everywhere, and delete your account — all from Settings.',
    items: [
      'New /settings/security page with per-session device details.',
      'Sign out everywhere clears server + browser state atomically so nothing loops back in.',
      'Account deletion is a soft delete with a 30-day grace window.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Idempotency-Key and strict Content Security Policy',
    tag: 'security',
    summary:
      'Retried POSTs are safe by default, and we ship a nonce-based strict CSP with tightened headers across the board.',
    items: [
      'All state-changing endpoints honour Idempotency-Key.',
      'Nonce-based script-src, no inline eval, hardened Referrer-Policy and Permissions-Policy.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Redis session-freshness cache',
    tag: 'improved',
    summary:
      'Dashboard renders no longer round-trip to Postgres on every request — the auth middleware short-caches session freshness in Redis with a 60-second TTL and a tombstone-on-revoke.',
  },
  {
    date: '2026-07-02',
    title: 'Accessible Confirm dialog replaces browser prompts',
    tag: 'improved',
    summary:
      'Destructive actions like deleting projects, cancelling subscriptions, and disconnecting publish targets now open a focus-trapped, keyboard-accessible confirmation dialog.',
  },
  {
    date: '2026-07-02',
    title: 'Pricing and About pages',
    tag: 'new',
    summary:
      'The marketing site now covers pricing (with live plan data from the billing catalog) and a short About page.',
  },
  {
    date: '2026-07-01',
    title: 'End-to-end harness, deploy workflow, i18n scaffolding',
    tag: 'infra',
    summary:
      'Playwright end-to-end tests run in CI, deploy workflow ships to staging on merge, and the app is scaffolded for multi-language support.',
  },
  {
    date: '2026-07-01',
    title: 'CDN and DNS Terraform, Grafana dashboards, Sentry + OpenTelemetry',
    tag: 'infra',
    summary:
      'Cache and DNS are now infrastructure-as-code. Errors flow to Sentry and traces to an OTLP collector — with prebuilt Grafana dashboards for the important signals.',
  },
  {
    date: '2026-07-01',
    title: 'Multi-track editor, ranking workflow, YouTube stats import',
    tag: 'new',
    summary:
      'The multi-track timeline shipped, the ranking workflow can compose highlights from long footage, and public YouTube video stats can be imported into rankings.',
  },
  {
    date: '2026-07-01',
    title: 'Publish targets, notifications, and admin ticket replies',
    tag: 'new',
    summary:
      'Connect publish destinations, receive in-app notifications for export/publish/ticket events, and let admins reply on tickets from the console.',
  },
  {
    date: '2026-07-01',
    title: 'Vitest infrastructure and Playwright/k6 scaffolds',
    tag: 'infra',
    summary:
      'Unit + integration test infra in place, plus baseline scaffolds for browser and load testing.',
  },
];
