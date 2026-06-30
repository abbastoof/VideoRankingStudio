import { ArrowRight, Clock, FileVideo, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@vrs/ui';

import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireSession();
  const greeting = greetingFor(session.user.name ?? session.user.email);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat('en', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/projects/new?mode=upload">
            <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />}>
              Upload footage
            </Button>
          </Link>
          <Link href="/projects/new">
            <Button leftIcon={<Sparkles className="h-4 w-4" />}>Start a new project</Button>
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects this month" value="0" hint="Free plan: up to 5" />
        <StatCard label="Transcription minutes used" value="0" hint="Free plan: 10 min" />
        <StatCard label="Voiceover characters used" value="0" hint="Free plan: 1,500 chars" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent projects</h2>
            <Link
              href="/projects"
              className="text-sm text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700">
                <FileVideo className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">No projects yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Start by uploading footage, pasting a video URL, or picking a template.
                We’ll handle the rest.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/projects/new">
                  <Button size="sm">Start a project</Button>
                </Link>
                <Link href="/templates">
                  <Button size="sm" variant="ghost">
                    Browse templates
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What’s next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Step done label="Verify your email" />
            <Step label="Create your first short" />
            <Step label="Train a voice clone" badge="Creator plan" />
            <Step label="Connect a publish target" badge="Creator plan" />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pick a starting point</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <TemplateCard
            href="/projects/new?template=listicle-quickfacts"
            title="Quick facts listicle"
            description="Five fast facts in 45 seconds. Punchy and shareable."
          />
          <TemplateCard
            href="/projects/new?template=top-10-ranking"
            title="Top 10 ranking"
            description="Countdown with split-screen visuals, ideal for niche topics."
          />
          <TemplateCard
            href="/projects/new?template=reddit-story"
            title="Narrated story"
            description="Voiceover over background footage. Long-watch-time format."
          />
        </div>
      </section>
    </div>
  );
}

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  const part =
    hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const display = name.includes('@') ? name.split('@')[0] : name.split(' ')[0];
  return `${part}, ${display}.`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Step({ label, done, badge }: { label: string; done?: boolean; badge?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        aria-hidden
        className={
          done
            ? 'h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center text-xs'
            : 'h-5 w-5 rounded-full border border-border bg-surface-muted'
        }
      >
        {done ? '✓' : <Clock className="h-3 w-3 text-muted-foreground" />}
      </span>
      <span className={done ? 'line-through text-muted-foreground' : 'text-foreground'}>{label}</span>
      {badge ? (
        <Badge tone="brand" className="ml-auto">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

function TemplateCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface-raised p-4 hover:border-brand-300 transition-colors group"
    >
      <div className="aspect-video rounded-md bg-gradient-to-br from-brand-100 to-brand-300 mb-3" aria-hidden />
      <h3 className="text-sm font-semibold group-hover:text-brand-700">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </Link>
  );
}
