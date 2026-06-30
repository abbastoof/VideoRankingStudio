import Link from 'next/link';
import { ArrowRight, Captions, Mic, Scissors, Sparkles, Upload, Wand2 } from 'lucide-react';

import { Badge, Button } from '@vrs/ui';

import { SiteFooter, SiteNav } from '@/components/SiteNav';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <Workflow />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="surface-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="container relative py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <Badge tone="brand" className="mx-auto">
            <Sparkles className="h-3.5 w-3.5" /> Now in public beta
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            From raw footage to a finished short, in one editor.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
            VideoRankingStudio finds the best moments, writes a script, picks a voice,
            burns the captions, and renders a vertical short. You stay in the loop —
            the AI just does the parts that aren’t worth your time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/signin?intent=signup">
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Start for free
              </Button>
            </Link>
            <Link href="/#workflow">
              <Button variant="ghost" size="lg">
                See how it works
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            No credit card. 5 free shorts per month. Cancel any paid plan in one click.
          </p>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Scissors,
    title: 'Highlight detection',
    body: 'Drop in a 30-minute video. The model scores energy, scene cuts, and faces to surface ranked highlights you can drag straight onto the timeline.',
  },
  {
    icon: Captions,
    title: 'Frame-accurate captions',
    body: 'Whisper transcribes in 90+ languages with word-level timing. Pick a style, edit a word, and the burn-in updates instantly.',
  },
  {
    icon: Mic,
    title: 'AI voiceover & cloning',
    body: 'Use a stock voice or train a personal clone in under a minute. Per-segment pitch and pace controls — no recording rig required.',
  },
  {
    icon: Wand2,
    title: 'Script generator',
    body: 'Type a topic, get a structured short. Rewrite for clarity, shorten to fit, or translate without leaving the editor.',
  },
  {
    icon: Upload,
    title: 'One-click publish',
    body: 'Render to 9:16, 1:1, 16:9, or 4:5 with EBU R128 loudness. Push directly to YouTube Shorts or TikTok when it’s ready.',
  },
  {
    icon: Sparkles,
    title: 'Template library',
    body: 'Reach-tested templates for listicles, stories, rankings, and tutorials. Pick one and the editor pre-fills the scenes.',
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="container py-20 md:py-28 space-y-12">
      <header className="max-w-2xl space-y-3">
        <Badge tone="neutral">Capabilities</Badge>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Everything you need to ship a short. Nothing that gets in your way.
        </h2>
        <p className="text-muted-foreground">
          The whole pipeline lives in one tab: import, edit, voice, caption, export, publish.
          The boring parts are automated. The creative parts are yours.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <article
            key={f.title}
            className="rounded-xl border border-border bg-surface-raised p-6 shadow-elevation transition-colors hover:border-brand-300"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    n: '01',
    title: 'Drop something in',
    body: 'Upload a file, paste a URL, type a script, or pick a template. The pipeline handles the rest.',
  },
  {
    n: '02',
    title: 'Let the AI do the prep',
    body: 'Highlights, captions, voice, and b-roll generate in parallel. You watch progress on a single timeline.',
  },
  {
    n: '03',
    title: 'Edit only what matters',
    body: 'Adjust the clips, polish the script, swap a voice. Every change is reflected in the live preview.',
  },
  {
    n: '04',
    title: 'Render and publish',
    body: 'Pick an aspect ratio, hit export, and either download or push straight to your channel.',
  },
];

function Workflow() {
  return (
    <section id="workflow" className="border-y border-border bg-surface-muted/40">
      <div className="container py-20 md:py-28 space-y-12">
        <header className="max-w-2xl space-y-3">
          <Badge tone="neutral">How it works</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Four steps from idea to upload.
          </h2>
        </header>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-border bg-background p-6 space-y-3"
            >
              <span className="font-mono text-xs text-brand-600">{s.n}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="container py-20 md:py-28">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-brand-foreground md:p-16">
        <div className="max-w-2xl space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Stop editing. Start publishing.
          </h2>
          <p className="text-base/relaxed opacity-90">
            Spend your time on the parts that move the needle — the hook, the take,
            the thumbnail. Let the studio do the rest. Free plan, no card.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signin?intent=signup">
              <Button variant="secondary" size="lg">
                Create your first short
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="lg" className="text-brand-foreground hover:bg-brand-600/20">
                Compare plans
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
