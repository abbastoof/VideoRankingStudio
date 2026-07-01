import type { Metadata } from 'next';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What we collect, why we collect it, and the controls you have.',
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="container max-w-3xl py-16 prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: 2026-01-01.</p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account data.</strong> Email address, display name, locale,
            time zone, and (if provided) a profile image.
          </li>
          <li>
            <strong>Content.</strong> Videos, audio, images, scripts, and
            project metadata you upload or generate.
          </li>
          <li>
            <strong>Usage.</strong> IP address, user agent, pages visited,
            actions taken, and diagnostic logs for security and reliability.
          </li>
          <li>
            <strong>Payment.</strong> Handled by Stripe. We store an invoice
            history but never your card number.
          </li>
        </ul>

        <h2>Why we collect it</h2>
        <p>
          To operate the Service, deliver features you request, prevent abuse,
          bill you, and improve the product. We do not sell your personal data.
        </p>

        <h2>Who processes it on our behalf</h2>
        <p>
          Sub-processors are chosen to run specific parts of the pipeline: an
          email provider for account codes and receipts, a payment processor
          for billing, cloud hosting for storage and compute, and AI providers
          for transcription, TTS, and generation. Each is bound by a data
          processing agreement.
        </p>

        <h2>Retention</h2>
        <ul>
          <li>Uploads: kept until you delete them or close your account, plus a 30-day grace period.</li>
          <li>Exports: retained for the duration of your plan; free-plan exports expire 7 days after render.</li>
          <li>Audit and security logs: 12 months.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          Depending on where you live you may have the right to access,
          correct, export, delete, or restrict processing of your personal
          data. Manage most of these directly in Settings; email{' '}
          <a href="mailto:privacy@videorankingstudio.local">privacy@videorankingstudio.local</a>{' '}
          for anything else.
        </p>

        <h2>Children</h2>
        <p>
          The Service is not directed to children under 13 (16 in the EEA and
          UK). We do not knowingly collect personal data from children below
          that age.
        </p>

        <h2>Security</h2>
        <p>
          Data is encrypted in transit and at rest. Sensitive tokens are stored
          in a hardware-backed secrets vault. See our{' '}
          <a href="/legal/security">security overview</a> for more detail.
        </p>

        <h2>Contact</h2>
        <p>
          Data controller: VideoRankingStudio. Email{' '}
          <a href="mailto:privacy@videorankingstudio.local">privacy@videorankingstudio.local</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
