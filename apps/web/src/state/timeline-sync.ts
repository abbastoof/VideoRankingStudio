'use client';

/**
 * Debounced timeline synchronisation.
 *
 * Whenever the editor store's `dirty` flag flips true, we buffer a save and
 * flush after a short quiet period. The save reconciles the local state
 * against the server by pushing clip mutations. Optimistic updates already
 * live in the store; we're only responsible for durability.
 */

import { API_URL } from '@/lib/api';
import { clientSdk } from '@/lib/client-sdk';

import { useEditorStore, type EditorClip, type EditorTrack } from './editor-store';

interface Snapshot {
  title: string;
  aspectRatio: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5';
  tracks: EditorTrack[];
}

let lastSnapshot: Snapshot | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

const SAVE_DEBOUNCE_MS = 900;

/**
 * Wire the editor store to autosave. Returns a cleanup function.
 */
export function startAutosave(projectId: string): () => void {
  const unsubscribe = useEditorStore.subscribe(
    (s) => ({ dirty: s.dirty, projectId: s.projectId }),
    ({ dirty, projectId: sp }) => {
      if (!dirty || sp !== projectId) return;
      scheduleSave(projectId);
    },
    { equalityFn: (a, b) => a.dirty === b.dirty && a.projectId === b.projectId },
  );
  return () => {
    unsubscribe();
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  };
}

function scheduleSave(projectId: string) {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    void flush(projectId);
  }, SAVE_DEBOUNCE_MS);
}

async function flush(projectId: string) {
  if (inFlight) {
    // Re-schedule so the next quiet period picks up any queued edits.
    scheduleSave(projectId);
    return;
  }
  const store = useEditorStore;
  const state = store.getState();
  if (!state.dirty || state.projectId !== projectId) return;

  const next: Snapshot = {
    title: state.title,
    aspectRatio: state.aspectRatio,
    tracks: state.tracks,
  };
  const prev = lastSnapshot ?? { title: '', aspectRatio: next.aspectRatio, tracks: [] };

  store.getState().markSaving();
  inFlight = true;
  const sdk = clientSdk();
  try {
    if (prev.title !== next.title || prev.aspectRatio !== next.aspectRatio) {
      await sdk.updateProject(projectId, { title: next.title, aspectRatio: next.aspectRatio });
    }

    const diffs = diffTracks(prev.tracks, next.tracks);
    for (const t of diffs.tracksAdded) {
      const created = await fetch(`${API_URL}/v1/projects/${projectId}/tracks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: t.kind, index: t.index, volume: t.volume }),
      }).then((r) => r.json());
      // Rewrite the store's local id to the server-assigned one so future
      // clip mutations reference a real row.
      useEditorStore.setState((s) => ({
        tracks: s.tracks.map((tt) => (tt.id === t.id ? { ...tt, id: created.id } : tt)),
      }));
    }
    for (const t of diffs.tracksUpdated) {
      await fetch(`${API_URL}/v1/projects/${projectId}/tracks/${t.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: t.muted, locked: t.locked, volume: t.volume, index: t.index }),
      });
    }
    for (const t of diffs.tracksRemoved) {
      await fetch(`${API_URL}/v1/projects/${projectId}/tracks/${t.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }

    // Clips: persist create/update/delete against the *current* track ids.
    for (const c of diffs.clipsCreated) {
      const created = await fetch(`${API_URL}/v1/projects/${projectId}/clips`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clipToPayload(c.clip, c.trackId)),
      }).then((r) => r.json());
      // Rewrite optimistic id → server id
      useEditorStore.getState().replaceClip({ ...c.clip, id: created.id });
    }
    for (const c of diffs.clipsUpdated) {
      await fetch(`${API_URL}/v1/projects/${projectId}/clips/${c.clip.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clipToPayload(c.clip, c.trackId, /* omitTrackId */ true)),
      });
    }
    for (const c of diffs.clipsRemoved) {
      await fetch(`${API_URL}/v1/projects/${projectId}/clips/${c.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }

    // Reorder pass — a single batched request captures cross-track moves.
    if (diffs.reordered.length > 0) {
      await fetch(`${API_URL}/v1/projects/${projectId}/clips/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: diffs.reordered }),
      });
    }

    lastSnapshot = { title: next.title, aspectRatio: next.aspectRatio, tracks: cloneTracks(next.tracks) };
    store.getState().markSaved();
  } catch (err) {
    console.error('autosave failed', err);
    store.getState().markError();
  } finally {
    inFlight = false;
    // If more edits arrived during the flush, immediately schedule the next.
    if (useEditorStore.getState().dirty) scheduleSave(projectId);
  }
}

/** Snapshot the current server-persisted state so autosave has a baseline. */
export function markInitialSnapshot() {
  const s = useEditorStore.getState();
  lastSnapshot = {
    title: s.title,
    aspectRatio: s.aspectRatio,
    tracks: cloneTracks(s.tracks),
  };
}

function cloneTracks(tracks: EditorTrack[]): EditorTrack[] {
  return tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c })) }));
}

function diffTracks(prev: EditorTrack[], next: EditorTrack[]) {
  const prevById = new Map(prev.map((t) => [t.id, t]));
  const nextById = new Map(next.map((t) => [t.id, t]));
  const tracksAdded: EditorTrack[] = next.filter((t) => !prevById.has(t.id));
  const tracksRemoved: EditorTrack[] = prev.filter((t) => !nextById.has(t.id));
  const tracksUpdated: EditorTrack[] = next.filter((t) => {
    const p = prevById.get(t.id);
    return p && (p.muted !== t.muted || p.locked !== t.locked || p.volume !== t.volume || p.index !== t.index);
  });

  const prevClips = new Map<string, { clip: EditorClip; trackId: string }>();
  for (const t of prev) for (const c of t.clips) prevClips.set(c.id, { clip: c, trackId: t.id });
  const nextClips = new Map<string, { clip: EditorClip; trackId: string }>();
  for (const t of next) for (const c of t.clips) nextClips.set(c.id, { clip: c, trackId: t.id });

  const clipsCreated: { clip: EditorClip; trackId: string }[] = [];
  const clipsUpdated: { clip: EditorClip; trackId: string }[] = [];
  const clipsRemoved: EditorClip[] = [];
  const reordered: { id: string; trackId?: string; startMs?: number }[] = [];

  for (const [id, entry] of nextClips) {
    const p = prevClips.get(id);
    if (!p) {
      clipsCreated.push(entry);
      continue;
    }
    if (p.trackId !== entry.trackId || p.clip.startMs !== entry.clip.startMs) {
      reordered.push({
        id,
        ...(p.trackId !== entry.trackId ? { trackId: entry.trackId } : {}),
        ...(p.clip.startMs !== entry.clip.startMs ? { startMs: entry.clip.startMs } : {}),
      });
    }
    if (clipsDiffer(p.clip, entry.clip)) {
      clipsUpdated.push(entry);
    }
  }
  for (const [id, entry] of prevClips) {
    if (!nextClips.has(id)) clipsRemoved.push(entry.clip);
  }

  return { tracksAdded, tracksRemoved, tracksUpdated, clipsCreated, clipsUpdated, clipsRemoved, reordered };
}

function clipsDiffer(a: EditorClip, b: EditorClip): boolean {
  return (
    a.durationMs !== b.durationMs ||
    a.inMs !== b.inMs ||
    a.outMs !== b.outMs ||
    a.speed !== b.speed ||
    a.volume !== b.volume ||
    a.opacity !== b.opacity ||
    a.isHighlight !== b.isHighlight ||
    a.source !== b.source ||
    a.assetId !== b.assetId ||
    a.voiceoverId !== b.voiceoverId ||
    JSON.stringify(a.text ?? null) !== JSON.stringify(b.text ?? null)
  );
}

function clipToPayload(clip: EditorClip, trackId: string, omitTrackId = false) {
  const payload: Record<string, unknown> = {
    source: clip.source,
    assetId: clip.assetId,
    voiceoverId: clip.voiceoverId,
    startMs: clip.startMs,
    durationMs: clip.durationMs,
    inMs: clip.inMs,
    outMs: clip.outMs,
    speed: clip.speed,
    volume: clip.volume,
    opacity: clip.opacity,
    isHighlight: clip.isHighlight,
  };
  if (clip.text) payload.text = { text: clip.text.value, color: clip.text.color, background: clip.text.background, fontSize: clip.text.size };
  if (!omitTrackId) payload.trackId = trackId;
  return payload;
}
