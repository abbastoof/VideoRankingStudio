import type { Metadata } from 'next';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Security overview',
  description:
    'How VideoRankingStudio protects your account, your source footage, and your generated work.',
};

export default function SecurityOverviewPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main
        id="main"
        className="container max-w-3xl py-16 prose prose-neutral dark:prose-invert"
      >
        <h1>Security overview</h1>
        <p className="text-sm text-muted-foreground">Last updated: 2026-07-02.</p>

        <p>
          This page summarises the security posture of VideoRankingStudio for
          creators, prospective customers, and security researchers. It is
          intentionally short and specific — every claim below is testable, and
          we&apos;d rather say less than promise more than we deliver.
        </p>

        <h2>Data in transit</h2>
        <ul>
          <li>
            All traffic between browsers, our API, and downstream storage is
            TLS 1.2+ with HSTS enabled at the edge (<code>max-age</code>{' '}
            two years, <code>includeSubDomains</code>, <code>preload</code>).
          </li>
          <li>
            The API sends a strict{' '}
            <code>Content-Security-Policy</code> that defaults to{' '}
            <code>self</code> and allow-lists only the origins we actually
            call from the browser.
          </li>
        </ul>

        <h2>Data at rest</h2>
        <ul>
          <li>
            Uploaded footage, generated audio and video, and exports live in
            object storage with server-side encryption enabled per bucket.
          </li>
          <li>
            Refresh tokens are stored as HMAC-SHA256 hashes — never in
            plaintext.
          </li>
          <li>
            One-time codes are hashed with the same primitive and expire in
            10 minutes.
          </li>
        </ul>

        <h2>Authentication</h2>
        <ul>
          <li>
            Sign-in is passwordless: a one-time code delivered by email, or
            Google OAuth. Session cookies are <code>HttpOnly</code>,{' '}
            <code>SameSite=lax</code>, and marked <code>Secure</code> in
            production.
          </li>
          <li>
            You can review every active session at{' '}
            <a href="/settings/security">Settings → Security</a>, revoke any
            device you don&apos;t recognise, or sign out everywhere with one
            click.
          </li>
          <li>
            A privileged action leaves an audit-log entry with actor, IP,
            user-agent, and target — including self-service session revocation
            and account deletion.
          </li>
        </ul>

        <h2>Isolation</h2>
        <ul>
          <li>
            Multi-tenancy is enforced at the query layer. Every request
            authenticated as user X can only ever see rows where{' '}
            <code>userId = X</code>. There is no shared queryable state
            across accounts.
          </li>
          <li>
            AI provider calls are proxied through our workers so provider
            keys never reach the browser.
          </li>
        </ul>

        <h2>Payment security</h2>
        <p>
          Card data is handled by Stripe. We never see the PAN. Our servers
          only receive Stripe customer and subscription IDs, and reconcile
          state via signed webhooks whose signatures we verify on every
          delivery.
        </p>

        <h2>Content moderation</h2>
        <p>
          Prompts submitted to LLM providers are moderated defence-in-depth
          before dispatch. Users can flag any generated output for review;
          admins process the queue and take down anything that violates our
          acceptable-use policy.
        </p>

        <h2>Rate limiting and abuse controls</h2>
        <ul>
          <li>
            Authentication endpoints and the public contact form are
            aggressively rate-limited by IP.
          </li>
          <li>
            Every state-changing route supports an <code>Idempotency-Key</code>{' '}
            header — replays return the cached response verbatim, and a same
            key with a different body is rejected as a client bug.
          </li>
        </ul>

        <h2>Vulnerability disclosure</h2>
        <p>
          If you&apos;ve found a vulnerability, please tell us before
          disclosing it publicly. Use{' '}
          <a href="/contact?topic=security">the security topic</a> on the
          contact form and we will acknowledge within 72 hours. Good-faith
          research is welcome; we won&apos;t pursue legal action against
          researchers who follow this policy.
        </p>

        <p>
          For a deeper look at how each of these controls is implemented,
          see the engineering references in{' '}
          <a
            href="https://github.com/abbastoof/VideoRankingStudio/blob/main/docs/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/SECURITY.md
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
