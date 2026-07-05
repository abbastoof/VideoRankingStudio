'use client';

import { Bookmark, CheckCircle2, CircleAlert, History, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import type { RankingDetail } from '@vrs/sdk';
import { Button, cn, Spinner } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

import { CandidateCard } from './CandidateCard';
import { GeneralSettingsCard, PlaybackOrderCard, TitleCard } from './SettingsCards';
import { RankingPreview } from './RankingPreview';
import { useRankingBuilder } from './useRankingBuilder';

/**
 * The Viblo-style single-page ranking builder: a scrollable form column
 * (title → general settings → playback order → one card per video → add
 * more) with a sticky live phone preview on the right and Save-as-Draft /
 * Generate actions in the footer.
 */
export function RankingBuilder({ initial }: { initial: RankingDetail }) {
  const router = useRouter();
  const builder = useRankingBuilder(initial);
  const { ranking, saveState, imports } = builder;
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      await builder.flush();
      await clientSdk().bakeRanking(ranking.projectId);
      const dims = aspectDims(ranking.aspectRatio);
      const out = await clientSdk().requestExport(ranking.projectId, {
        format: 'MP4_H264',
        resolutionW: dims.w,
        resolutionH: dims.h,
        fps: 30,
        burnCaptions: ranking.captionsEnabled,
        normalizeLoudness: true,
      });
      router.push(`/projects/${ranking.projectId}/exports/${out.exportId}`);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Could not generate the video');
      setGenerating(false);
    }
  }

  async function saveDraft() {
    try {
      await builder.flush();
      router.push('/dashboard');
    } catch {
      // saveState already shows the error state; stay on the page.
    }
  }

  const readyCandidates = ranking.candidates.filter((c) => c.assetId).length;

  // Presigned media URLs expire (~1h). When a preview clip errors, re-fetch
  // fresh URLs — at most once every 30s so a truly broken file can't loop.
  const lastMediaRefresh = useRef(0);
  const { refresh } = builder;
  const onMediaError = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefresh.current < 30_000) return;
    lastMediaRefresh.current = now;
    void refresh().catch(() => {});
  }, [refresh]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Video Ranking</h1>
          <SaveBadge state={saveState} />
        </div>
        <Link
          href="/rankings"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm text-brand-700 transition-colors',
            'hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
          )}
        >
          <History className="h-4 w-4" aria-hidden />
          Recently Created
        </Link>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form column */}
        <div className="space-y-5">
          <TitleCard ranking={ranking} patchMeta={builder.patchMeta} />
          <GeneralSettingsCard ranking={ranking} patchMeta={builder.patchMeta} />
          <PlaybackOrderCard ranking={ranking} patchMeta={builder.patchMeta} />

          {ranking.candidates.map((candidate, i) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              index={i}
              count={ranking.candidates.length}
              importState={imports[candidate.id]}
              onPatch={(patch) => builder.patchCandidate(candidate.id, patch)}
              onImportUrl={(url) => void builder.importFromUrl(candidate.id, url)}
              onUploadFile={(file) => void builder.uploadFile(candidate.id, file)}
              onMove={(dir) => builder.moveCandidate(candidate.id, dir)}
              onRemove={() => void builder.removeCandidate(candidate.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => {
              setAdding(true);
              void builder.addCandidate().finally(() => setAdding(false));
            }}
            disabled={adding}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-300 px-4 py-4 text-sm font-medium text-brand-700 transition-colors',
              'hover:border-brand-400 hover:bg-brand-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              'disabled:pointer-events-none disabled:opacity-60',
            )}
          >
            {adding ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" aria-hidden />}
            Add More Video
          </button>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="secondary"
              onClick={() => void saveDraft()}
              leftIcon={<Bookmark className="h-4 w-4" />}
            >
              Save as Draft
            </Button>
            <div className="flex flex-col items-end gap-1.5">
              <Button
                onClick={() => void generate()}
                loading={generating}
                disabled={readyCandidates === 0}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Generate Video Ranking
              </Button>
              {readyCandidates === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Attach at least one video to generate.
                </p>
              ) : null}
              {generateError ? (
                <p role="alert" className="text-xs text-danger">
                  {generateError}
                </p>
              ) : null}
            </div>
          </footer>
        </div>

        {/* Preview rail */}
        <aside className="lg:sticky lg:top-6">
          <h2 className="mb-3 text-center text-sm font-semibold text-muted-foreground">Preview</h2>
          <RankingPreview ranking={ranking} onMediaError={onMediaError} />
        </aside>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Spinner className="h-3 w-3" />
        Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger" role="alert">
        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
        Not saved — check your connection
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
      Saved
    </span>
  );
}

function aspectDims(a: string): { w: number; h: number } {
  return (
    {
      R9_16: { w: 1080, h: 1920 },
      R1_1: { w: 1080, h: 1080 },
      R4_5: { w: 1080, h: 1350 },
      R16_9: { w: 1920, h: 1080 },
    }[a as 'R9_16' | 'R1_1' | 'R4_5' | 'R16_9'] ?? { w: 1080, h: 1920 }
  );
}
