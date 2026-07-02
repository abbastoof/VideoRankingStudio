import type { Metadata } from 'next';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The rules for using VideoRankingStudio, written to be legible without a lawyer on retainer.',
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">
          Effective date: 2026-01-01. Last updated: 2026-01-01.
        </p>

        <p>
          These Terms govern your use of VideoRankingStudio (the "Service"). By
          creating an account or using the Service, you agree to be bound by
          them. If you do not agree, do not use the Service.
        </p>

        <h2>1. Your account</h2>
        <p>
          You must be at least 13 years old to use the Service (16 in the EEA
          and UK). You are responsible for the content you upload and for
          keeping your sign-in secure. You may not share your account.
        </p>

        <h2>2. Acceptable use</h2>
        <p>
          You agree not to use the Service to produce or distribute content
          that (a) infringes anyone's rights (including copyright and
          publicity), (b) sexualises or depicts minors, (c) constitutes
          harassment, threats, or hate speech, (d) impersonates a real person
          without consent, (e) violates law, or (f) attempts to exploit,
          reverse-engineer, or damage the Service or its infrastructure.
        </p>

        <h2>3. Voice cloning</h2>
        <p>
          Voice-clone models may only be trained on recordings for which you
          have the speaker's explicit, revocable consent. You must retain that
          consent for as long as the clone is in use. We reserve the right to
          disable any clone we reasonably believe was created without consent.
        </p>

        <h2>4. AI outputs</h2>
        <p>
          The Service uses generative models to help you draft scripts, images,
          and audio. Outputs are best-effort. You are responsible for reviewing
          them before publishing. We make no guarantee that outputs are
          accurate, non-infringing, or fit for a particular purpose.
        </p>

        <h2>5. Paid plans</h2>
        <p>
          Paid plans renew automatically until you cancel. Cancellations take
          effect at the end of the current billing period; refunds outside
          statutory rights are at our discretion. We may change prices with 30
          days' notice.
        </p>

        <h2>6. Ownership</h2>
        <p>
          You retain ownership of the content you upload and of the finished
          exports you produce. You grant us a non-exclusive, worldwide licence
          to process, store, transcode, and transmit your content strictly as
          needed to operate the Service. The Service itself, including its
          software, brand, and models, remains our property.
        </p>

        <h2>7. Termination</h2>
        <p>
          You can close your account at any time from settings. We may suspend
          or terminate accounts that violate these Terms, that pose a security
          or fraud risk, or that we are required by law to remove.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided "as is." To the fullest extent permitted by
          law, we disclaim implied warranties of merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, our aggregate liability for
          any claim arising from the Service is limited to the greater of
          US$100 or the amount you paid us in the 12 months preceding the
          event giving rise to the claim.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update these Terms. If the changes are material, we will
          notify you at least 15 days before they take effect. Continued use of
          the Service after the effective date constitutes acceptance.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions? Email <a href="mailto:legal@videorankingstudio.local">legal@videorankingstudio.local</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
