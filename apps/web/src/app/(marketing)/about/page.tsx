import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Button } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why we build VideoRankingStudio: to make short-form video production a decision, not a chore.',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="container py-16 md:py-24 space-y-6 max-w-3xl">
          <Badge tone="brand">Our mission</Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Make short-form video production a decision, not a chore.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Ambitious creators spend most of their time on the plumbing:
            transcribing, splitting, timing, captioning, exporting, republishing.
            The interesting work — the hook, the take, the argument — is a
            fraction of the total effort. We built VideoRankingStudio to invert
            that ratio. The pipeline is automatic; you spend your time on the
            parts that move the needle.
          </p>
        </section>

        <section className="border-y border-border bg-surface-muted/40">
          <div className="container py-16 md:py-20 grid gap-8 md:grid-cols-3">
            <Principle
              title="Own the pipeline, not the model."
              body="Every AI capability is provider-swappable behind a config flag. When a better model lands, we route to it. When a provider degrades, we route away. The creator experience is what we hold constant."
            />
            <Principle
              title="Design for the ninth hour."
              body="Creators come back to the editor tired and behind schedule. Every keystroke, every wait state, every error message is designed for that person — not the fresh-morning demo user."
            />
            <Principle
              title="Trust cascades."
              body="One-click cancel. No usage overages without consent. Clear billing. Consent required for voice cloning. Signed URL exports. If we get any of these wrong, the rest doesn't matter."
            />
          </div>
        </section>

        <section className="container py-16 md:py-20 max-w-3xl space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">What we're building next</h2>
          <p className="text-muted-foreground leading-relaxed">
            The public{' '}
            <Link href="/roadmap" className="text-brand-600 underline underline-offset-4 hover:text-brand-700">
              roadmap
            </Link>{' '}
            is where we plan in the open — what we&apos;re shaping, what
            we&apos;re actively building, and what already shipped. Multi-
            language interfaces, richer voice cloning controls, deeper
            retention analytics, and a mobile review companion are all in
            flight.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            If you have a use case we haven&apos;t thought about, we want to hear it.
          </p>
          <div className="flex flex-wrap gap-3 pt-4">
            <Link href="/contact">
              <Button size="lg">Say hello</Button>
            </Link>
            <Link href="/signin?intent=signup">
              <Button size="lg" variant="ghost">
                Try the editor free
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
