'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  RankingCandidatePatch,
  RankingDetail,
  RankingMetaPatch,
} from '@vrs/sdk';

import { clientSdk } from '@/lib/client-sdk';

export type SaveState = 'saved' | 'saving' | 'error';

export interface ImportState {
  status: 'idle' | 'importing' | 'error';
  error?: string;
}

/**
 * State container for the ranking builder page.
 *
 * Every mutation applies optimistically to local state, then syncs to the
 * API. Meta patches are debounced per burst (600 ms) so slider drags and
 * typing don't stampede the server; structural changes (candidates,
 * reorder) sync immediately.
 */
export function useRankingBuilder(initial: RankingDetail) {
  const [ranking, setRanking] = useState<RankingDetail>(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [imports, setImports] = useState<Record<string, ImportState>>({});

  const pendingMeta = useRef<RankingMetaPatch>({});
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const track = useCallback(async <T,>(op: () => Promise<T>): Promise<T | undefined> => {
    inflight.current += 1;
    setSaveState('saving');
    try {
      const out = await op();
      inflight.current -= 1;
      if (mounted.current && inflight.current === 0) setSaveState('saved');
      return out;
    } catch (err) {
      inflight.current -= 1;
      if (mounted.current) setSaveState('error');
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await clientSdk().getRanking(initial.projectId);
    if (mounted.current) setRanking(data);
  }, [initial.projectId]);

  /** Optimistic local meta update + debounced PATCH. */
  const patchMeta = useCallback(
    (patch: RankingMetaPatch) => {
      setRanking((r) => ({ ...r, ...(patch as Partial<RankingDetail>) }));
      pendingMeta.current = { ...pendingMeta.current, ...patch };
      if (metaTimer.current) clearTimeout(metaTimer.current);
      metaTimer.current = setTimeout(() => {
        const body = pendingMeta.current;
        pendingMeta.current = {};
        metaTimer.current = null;
        void track(() => clientSdk().updateRanking(initial.projectId, body)).catch(() => {});
      }, 600);
    },
    [initial.projectId, track],
  );

  /** Flush any debounced meta patch immediately (Save as Draft, Generate). */
  const flush = useCallback(async () => {
    if (metaTimer.current) {
      clearTimeout(metaTimer.current);
      metaTimer.current = null;
    }
    if (Object.keys(pendingMeta.current).length > 0) {
      const body = pendingMeta.current;
      pendingMeta.current = {};
      await track(() => clientSdk().updateRanking(initial.projectId, body));
    }
  }, [initial.projectId, track]);

  useEffect(
    () => () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
    },
    [],
  );

  const patchCandidate = useCallback(
    (candidateId: string, patch: RankingCandidatePatch, opts?: { debounce?: boolean }) => {
      setRanking((r) => ({
        ...r,
        candidates: r.candidates.map((c) =>
          c.id === candidateId ? { ...c, ...(patch as Partial<typeof c>) } : c,
        ),
      }));
      // Candidate patches are small and infrequent enough to send directly;
      // trim drags call this on pointer-up, not per-move.
      void track(() =>
        clientSdk().updateRankingCandidate(initial.projectId, candidateId, patch),
      ).catch(() => {});
      void opts;
    },
    [initial.projectId, track],
  );

  const addCandidate = useCallback(async () => {
    const n = ranking.candidates.length + 1;
    await track(async () => {
      await clientSdk().addRankingCandidate(initial.projectId, {
        title: `Video ${n}`,
        score: 0,
      });
    });
    await refresh();
  }, [initial.projectId, ranking.candidates.length, refresh, track]);

  const removeCandidate = useCallback(
    async (candidateId: string) => {
      setRanking((r) => ({
        ...r,
        candidates: r.candidates.filter((c) => c.id !== candidateId),
      }));
      await track(() => clientSdk().deleteRankingCandidate(initial.projectId, candidateId));
    },
    [initial.projectId, track],
  );

  const moveCandidate = useCallback(
    (candidateId: string, dir: 'up' | 'down') => {
      setRanking((r) => {
        const idx = r.candidates.findIndex((c) => c.id === candidateId);
        const target = dir === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || target < 0 || target >= r.candidates.length) return r;
        const next = r.candidates.slice();
        [next[idx], next[target]] = [next[target]!, next[idx]!];
        void track(() =>
          clientSdk().reorderRankingCandidates(
            r.projectId,
            next.map((c) => c.id),
          ),
        ).catch(() => {});
        return { ...r, candidates: next };
      });
    },
    [track],
  );

  const reorderTo = useCallback(
    (orderedIds: string[]) => {
      setRanking((r) => {
        const byId = new Map(r.candidates.map((c) => [c.id, c]));
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
        void track(() => clientSdk().reorderRankingCandidates(r.projectId, orderedIds)).catch(
          () => {},
        );
        return { ...r, candidates: next };
      });
    },
    [track],
  );

  /** Import a platform link into a candidate: spinner → asset + auto-title. */
  const importFromUrl = useCallback(
    async (candidateId: string, url: string) => {
      setImports((m) => ({ ...m, [candidateId]: { status: 'importing' } }));
      try {
        const sdk = clientSdk();
        const { jobId, assetId } = await sdk.importFromUrl({
          url,
          projectId: initial.projectId,
          audioOnly: false,
        });

        const deadline = Date.now() + 5 * 60_000;
        let resultTitle: string | undefined;
        for (;;) {
          if (Date.now() > deadline) throw new Error('Import timed out');
          const job = await sdk.getJob(jobId);
          if (job.status === 'SUCCEEDED') {
            const result = (job.resultJson ?? {}) as { title?: string };
            resultTitle = typeof result.title === 'string' ? result.title : undefined;
            break;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELED') {
            throw new Error(job.errorMessage ?? 'Import failed');
          }
          await sleep(1500);
        }

        const current = ranking.candidates.find((c) => c.id === candidateId);
        const patch: RankingCandidatePatch = {
          assetId,
          sourceUrl: url,
          // Auto-fill the title from the platform metadata unless the user
          // already typed a real one.
          ...(resultTitle && (!current || isPlaceholderTitle(current.title))
            ? { title: resultTitle.slice(0, 200) }
            : {}),
        };
        await track(() =>
          clientSdk().updateRankingCandidate(initial.projectId, candidateId, patch),
        );
        await refresh();
        setImports((m) => ({ ...m, [candidateId]: { status: 'idle' } }));
      } catch (err) {
        setImports((m) => ({
          ...m,
          [candidateId]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Import failed',
          },
        }));
      }
    },
    [initial.projectId, ranking.candidates, refresh, track],
  );

  /** Upload a local file into a candidate via the presigned flow. */
  const uploadFile = useCallback(
    async (candidateId: string, file: File) => {
      setImports((m) => ({ ...m, [candidateId]: { status: 'importing' } }));
      try {
        const sdk = clientSdk();
        const init = await sdk.initUpload({
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
          sizeBytes: file.size,
          kind: 'VIDEO',
          projectId: initial.projectId,
        });
        const put = await fetch(init.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'video/mp4' },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        await sdk.completeUpload({ assetId: init.assetId });
        await track(() =>
          clientSdk().updateRankingCandidate(initial.projectId, candidateId, {
            assetId: init.assetId,
          }),
        );
        await refresh();
        setImports((m) => ({ ...m, [candidateId]: { status: 'idle' } }));
      } catch (err) {
        setImports((m) => ({
          ...m,
          [candidateId]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          },
        }));
      }
    },
    [initial.projectId, refresh, track],
  );

  return {
    ranking,
    saveState,
    imports,
    patchMeta,
    patchCandidate,
    addCandidate,
    removeCandidate,
    moveCandidate,
    reorderTo,
    importFromUrl,
    uploadFile,
    refresh,
    flush,
  };
}

function isPlaceholderTitle(title: string): boolean {
  return /^Video \d+$/.test(title.trim()) || title.trim().length === 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
