import type { Metadata } from 'next';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'DMCA & Copyright',
  description: 'How to report copyright infringement on VideoRankingStudio.',
};

export default function DmcaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="container max-w-3xl py-16 prose prose-neutral dark:prose-invert">
        <h1>DMCA & Copyright</h1>
        <p className="text-sm text-muted-foreground">Effective date: 2026-01-01.</p>

        <p>
          We respect intellectual property rights and expect our users to do the
          same. If you believe content on VideoRankingStudio infringes your
          copyright, follow the process below.
        </p>

        <h2>Filing a notice</h2>
        <p>Send an email to <a href="mailto:dmca@videorankingstudio.local">dmca@videorankingstudio.local</a> that includes all of the following:</p>
        <ol>
          <li>A description of the copyrighted work you claim was infringed.</li>
          <li>A URL, project id, or export id that identifies the infringing material.</li>
          <li>Your contact information: name, address, telephone number, and email.</li>
          <li>A statement, under penalty of perjury, that the information is accurate and that you are the rights holder or authorised to act on behalf of the rights holder.</li>
          <li>A statement that you have a good-faith belief that the use is not authorised by the rights holder, its agent, or the law.</li>
          <li>Your physical or electronic signature.</li>
        </ol>

        <h2>Counter-notice</h2>
        <p>
          If your content was removed and you believe the removal was a mistake
          or misidentification, you may file a counter-notice at the same
          address. Include the identification of the removed content, contact
          information, consent to jurisdiction, and a good-faith statement
          under penalty of perjury.
        </p>

        <h2>Repeat infringers</h2>
        <p>
          Accounts that receive multiple valid notices will be suspended and,
          for egregious or repeat violations, terminated.
        </p>

        <h2>Abuse & impersonation</h2>
        <p>
          For non-copyright issues — impersonation, deepfake misuse without
          consent, harassment, or unsafe content — file a report through the{' '}
          <a href="/support/new">Support</a> page or email{' '}
          <a href="mailto:trust@videorankingstudio.local">trust@videorankingstudio.local</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
