'use client';

import { ArrowLeft, LayoutGrid, Monitor } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Button, Card, CardContent } from '@vrs/ui';

interface MobileEditorGateProps {
  projectTitle?: string;
  children: ReactNode;
}

/**
 * The multi-track editor needs a wide viewport: the timeline alone reserves
 * 130px for headers plus at least a few hundred pixels of scrubbable track
 * area, and the inspector sidebar is a fixed 360px. On phones there simply
 * isn't room for meaningful editing without shrinking hitboxes below what a
 * finger can hit accurately.
 *
 * Rather than ship a degraded editor, we gate the route on `<lg` viewports
 * and offer clear escape hatches — back to projects, back to dashboard. The
 * gate lives on the client because the server has no way to detect viewport;
 * we render neutral markup on first paint so hydration is clean, then swap
 * in the gate or the editor once we know the viewport size.
 */
export function MobileEditorGate({ projectTitle, children }: MobileEditorGateProps) {
  const [decided, setDecided] = useState<'unknown' | 'wide' | 'narrow'>('unknown');

  useEffect(() => {
    // Tailwind's `lg` breakpoint is 1024px. Anything below that struggles to
    // fit the timeline + inspector without overflow.
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setDecided(mq.matches ? 'wide' : 'narrow');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (decided === 'unknown') {
    // Neutral placeholder — matches editor's dark chrome so there's no
    // flash while we resolve the viewport.
    return (
      <div
        aria-hidden
        className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-background"
      />
    );
  }

  if (decided === 'narrow') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg items-center justify-center p-6">
        <Card className="w-full">
          <CardContent className="space-y-5 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-700">
              <Monitor className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-xl font-semibold tracking-tight">
                The editor is designed for desktop
              </h1>
              <p className="text-sm text-muted-foreground">
                {projectTitle ? (
                  <>
                    Open <span className="font-medium text-foreground">{projectTitle}</span>{' '}
                    on a laptop or desktop to edit clips, tracks, captions, and voiceovers.
                  </>
                ) : (
                  <>Open this project on a laptop or desktop to edit clips, tracks, captions, and voiceovers.</>
                )}{' '}
                You can still manage projects, review exports, and browse your
                dashboard on mobile.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
              <Link href="/projects" className="sm:flex-1">
                <Button variant="outline" fullWidth leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  All projects
                </Button>
              </Link>
              <Link href="/dashboard" className="sm:flex-1">
                <Button fullWidth leftIcon={<LayoutGrid className="h-4 w-4" />}>
                  Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
