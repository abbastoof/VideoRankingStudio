'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  RankingCandidatePatch,
  RankingDetail,
  RankingMetaPatch,
} from '@vrs/sdk';
import { useToast } from '@vrs/ui';

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
 *
 * `flush()` is the write barrier: it sends the pending debounced patch AND
 * drains every in-flight save, so callers (Generate) know the server has
 * everything the UI shows before they bake.
 */
export function useRankingBuilder(initial: RankingDetail) {
  const toast = useToast();
  const [ranking, setRanking] = useState<RankingDetail>(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [imports, setImports] = useState<Record<string, ImportState>>({});

  // Always-current mirror so callbacks can read the latest state without
  // doing work inside setState updaters (which must stay pure).
  const rankingRef = useRef(ranking);
  rankingRef.current = ranking;

  const pendingMeta = useRef<RankingMetaPatch>({});
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightOps = useRef(new Set<Promise<unknown>>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const track = useCallback(async <T,>(op: () => Promise<T>): Promise<T> => {
    setSaveState('saving');
    const p = op();
    inflightOps.current.add(p);
    try {
      const out = await p;
      if (mounted.current && inflightOps.current.size === 1) setSaveState('saved');
      return out;
    } catch (err) {
      if (mounted.current) setSaveState('error');
      throw err;
    } finally {
      inflightOps.current.delete(p);
    }
  }, []);

  /** Wait until no save is in flight (new ops started meanwhile included). */
  const drainSaves = useCallback(async () => {
    while (inflightOps.current.size > 0) {
      await Promise.allSettled([...inflightOps.current]);
    }
  }, []);

  /**
   * Re-fetch from the server. Runs after structural changes (add, import,
   * upload). Drains in-flight saves first and re-applies the not-yet-sent
   * debounced meta patch so a refresh never rolls back what the user sees.
   */
  const refresh = useCallback(async () => {
    await drainSaves();
    const data = await clientSdk().getRanking(initial.projectId);
    if (mounted.current) {
      setRanking({ ...data, ...(pendingMeta.current as Partial<RankingDetail>) });
    }
  }, [drainSaves, initial.projectId]);

  /** Order candidates locally the way the server will (score or stored). */
  const applyServerOrder = useCallback((serverCandidates: Array<{ id: string }>) => {
    setRanking((r) => {
      const pos = new Map(serverCandidates.map((c, i) => [c.id, i]));
      const next = [...r.candidates].sort(
        (a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
      return { ...r, candidates: next };
    });
  }, []);

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
        const reorders = body.order !== undefined || body.orderMode !== undefined;
        void track(async () => {
          const data = await clientSdk().updateRanking(initial.projectId, body);
          // Ordering semantics changed: adopt the server's candidate order so
          // the cards + preview show what Generate will bake.
          if (reorders && mounted.current) applyServerOrder(data.candidates);
        }).catch(() => {});
      }, 600);
    },
    [applyServerOrder, initial.projectId, track],
  );

  /**
   * Write barrier: send the pending debounced meta patch, then wait for every
   * in-flight save (meta, candidate, reorder) to settle.
   */
  const flush = useCallback(async () => {
    if (metaTimer.current) {
      clearTimeout(metaTimer.current);
      metaTimer.current = null;
    }
    if (Object.keys(pendingMeta.current).length > 0) {
      const body = pendingMeta.current;
      pendingMeta.current = {};
      const reorders = body.order !== undefined || body.orderMode !== undefined;
      await track(async () => {
        const data = await clientSdk().updateRanking(initial.projectId, body);
        if (reorders && mounted.current) applyServerOrder(data.candidates);
      });
    }
    await drainSaves();
  }, [applyServerOrder, drainSaves, initial.projectId, track]);

  // Unmount: the debounced patch would otherwise be lost — fire best-effort.
  useEffect(
    () => () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
      if (Object.keys(pendingMeta.current).length > 0) {
        const body = pendingMeta.current;
        pendingMeta.current = {};
        void clientSdk().updateRanking(initial.projectId, body).catch(() => {});
      }
    },
    [initial.projectId],
  );

  const patchCandidate = useCallback(
    (candidateId: string, patch: RankingCandidatePatch) => {
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
    },
    [initial.projectId, track],
  );

  const addCandidate = useCallback(async () => {
    const n = rankingRef.current.candidates.length + 1;
    await track(async () => {
      await clientSdk().addRankingCandidate(initial.projectId, {
        title: `Video ${n}`,
        score: 0,
      });
    });
    await refresh();
  }, [initial.projectId, refresh, track]);

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
      const current = rankingRef.current.candidates;
      const idx = current.findIndex((c) => c.id === candidateId);
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || target < 0 || target >= current.length) return;
      const next = current.slice();
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      setRanking((r) => ({ ...r, candidates: next }));
      void track(() =>
        clientSdk().reorderRankingCandidates(
          initial.projectId,
          next.map((c) => c.id),
        ),
      ).catch(() => {});
    },
    [initial.projectId, track],
  );

  const reorderTo = useCallback(
    (orderedIds: string[]) => {
      const byId = new Map(rankingRef.current.candidates.map((c) => [c.id, c]));
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      setRanking((r) => ({ ...r, candidates: next }));
      void track(() => clientSdk().reorderRankingCandidates(initial.projectId, orderedIds)).catch(
        () => {},
      );
    },
    [initial.projectId, track],
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

        // Read the candidate as it is NOW, not as it was at click time.
        const current = rankingRef.current.candidates.find((c) => c.id === candidateId);
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
        toast({
          tone: 'success',
          title: 'Video imported',
          description: resultTitle ? `"${resultTitle.slice(0, 80)}"` : undefined,
        });
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
    [initial.projectId, refresh, toast, track],
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
        toast({ tone: 'success', title: 'Video uploaded', description: file.name });
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
    [initial.projectId, refresh, toast, track],
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
