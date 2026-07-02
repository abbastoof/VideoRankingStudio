/**
 * Public roadmap.
 *
 * Three columns: discovery (we're still shaping it), building (someone is
 * actively working on it), and shipped (done and in production).
 *
 * Keep entries short — one clear headline plus a sentence of "what will the
 * creator get out of it." No dates on unshipped items; roadmaps that promise
 * dates end up as apology posts.
 */

export type RoadmapColumn = 'discovery' | 'building' | 'shipped';

export interface RoadmapItem {
  title: string;
  outcome: string;
  column: RoadmapColumn;
  /** Optional shipped date, only meaningful for `column: 'shipped'`. */
  shippedOn?: string;
}

export const roadmap: RoadmapItem[] = [
  // ── Discovery ──────────────────────────────────────────────────
  {
    column: 'discovery',
    title: 'Multi-language captions and voiceovers',
    outcome:
      'Translate captions and re-generate voiceovers into 10+ languages from a single source track.',
  },
  {
    column: 'discovery',
    title: 'Team workspaces',
    outcome:
      'Shared projects, roles, and per-seat billing for two-to-ten-person creative teams.',
  },
  {
    column: 'discovery',
    title: 'Retention analytics on published videos',
    outcome:
      'Pull retention curves for videos you publish through the studio, so you can see which hook shape actually works for your audience.',
  },
  {
    column: 'discovery',
    title: 'Voice cloning consent workflow',
    outcome:
      'A signed consent flow to legally clone a voice for use across the studio — with revocation and audit trail.',
  },

  // ── Building ───────────────────────────────────────────────────
  {
    column: 'building',
    title: 'Public developer API',
    outcome:
      'A documented, versioned API + keys so you can wire the studio into your own pipeline.',
  },
  {
    column: 'building',
    title: 'Batch export queue',
    outcome:
      'Queue and render dozens of exports overnight without babysitting the editor.',
  },
  {
    column: 'building',
    title: 'Mobile companion for reviewing renders',
    outcome:
      'Preview exports, approve or reject renders, and share short review links from a phone.',
  },

  // ── Shipped ────────────────────────────────────────────────────
  {
    column: 'shipped',
    title: 'Session management and self-service deletion',
    outcome: 'See every active session, sign out anywhere, delete your account with a 30-day grace period.',
    shippedOn: '2026-07-02',
  },
  {
    column: 'shipped',
    title: 'Idempotency-Key + strict CSP',
    outcome: 'Retried POSTs are safe and the site ships a nonce-based strict Content Security Policy.',
    shippedOn: '2026-07-02',
  },
  {
    column: 'shipped',
    title: 'Mobile navigation and desktop-recommended editor gate',
    outcome: 'App is usable on phones; the editor gracefully redirects small viewports back to safe surfaces.',
    shippedOn: '2026-07-02',
  },
  {
    column: 'shipped',
    title: 'Live status page',
    outcome: 'Real-time component health at /status — no fake uptime marketing.',
    shippedOn: '2026-07-02',
  },
  {
    column: 'shipped',
    title: 'Multi-track editor with autosave',
    outcome: 'Timeline with video, audio, and caption tracks; edits persist automatically.',
    shippedOn: '2026-07-01',
  },
  {
    column: 'shipped',
    title: 'AI script, highlights, and voiceover',
    outcome: 'Draft scripts from a brief, extract highlights from long footage, and render an AI voiceover — all in one flow.',
    shippedOn: '2026-07-01',
  },
  {
    column: 'shipped',
    title: 'Stripe billing end-to-end',
    outcome: 'Plans, subscriptions, invoices, portal, and one-click cancel.',
    shippedOn: '2026-06-30',
  },
];
