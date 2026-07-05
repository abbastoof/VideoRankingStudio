'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { ProjectAspectRatio } from '@vrs/types';

import {
  emptyHistory,
  invert,
  push,
  redo as redoHistory,
  undo as undoHistory,
  type Command,
  type History,
} from './history';

export interface EditorClip {
  id: string;
  source: 'ASSET' | 'VOICEOVER' | 'GENERATED_IMAGE' | 'GENERATED_VIDEO' | 'TEXT';
  assetId: string | null;
  voiceoverId: string | null;
  startMs: number;
  durationMs: number;
  inMs: number;
  outMs: number;
  speed: number;
  volume: number;
  opacity: number;
  isHighlight: boolean;
  text?: {
    value: string;
    color?: string;
    background?: string | null;
    size?: number;
    fontFamily?: string;
    fontWeight?: number;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    /** Block-center position as % of canvas (design space). */
    xPct?: number | null;
    yPct?: number | null;
    strokeColor?: string;
    strokeWidth?: number;
  };
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
}

export interface EditorTrack {
  id: string;
  kind: 'VIDEO' | 'AUDIO' | 'CAPTION' | 'OVERLAY';
  index: number;
  muted: boolean;
  locked: boolean;
  volume: number;
  clips: EditorClip[];
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorState {
  projectId: string | null;
  title: string;
  aspectRatio: ProjectAspectRatio;
  durationMs: number;
  pxPerSecond: number;
  playheadMs: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  tracks: EditorTrack[];
  dirty: boolean;
  history: History;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  activeJobs: Record<string, { kind: string; progress: number; status: string; message?: string; errorMessage?: string }>;

  hydrate: (input: Partial<EditorState> & Pick<EditorState, 'projectId' | 'tracks'>) => void;
  setTitle: (title: string) => void;
  setAspectRatio: (a: ProjectAspectRatio) => void;

  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (px: number) => void;

  setPlayhead: (ms: number) => void;
  setPlaying: (playing: boolean) => void;

  selectClip: (id: string | null) => void;
  selectTrack: (id: string | null) => void;

  moveClip: (clipId: string, deltaMs: number, opts?: { record?: boolean }) => void;
  trimClip: (clipId: string, edge: 'start' | 'end', deltaMs: number, opts?: { record?: boolean }) => void;
  splitClipAtPlayhead: () => void;
  deleteClip: (clipId: string) => void;
  addClip: (trackKind: EditorTrack['kind'], clip: Omit<EditorClip, 'id'>) => EditorClip;
  addClipToVideoTrack: (clip: Omit<EditorClip, 'id'>) => void; // backwards-compat
  replaceClip: (clip: EditorClip) => void;
  createTrack: (kind: EditorTrack['kind']) => EditorTrack;
  removeTrack: (trackId: string) => void;
  toggleTrackMuted: (trackId: string) => void;
  toggleTrackLocked: (trackId: string) => void;

  undo: () => void;
  redo: () => void;

  markSaving: () => void;
  markSaved: () => void;
  markError: () => void;

  setJob: (jobId: string, info: EditorState['activeJobs'][string]) => void;
  clearJob: (jobId: string) => void;
}

const DEFAULT_PX_PER_SECOND = 50;

function applyCommand(state: EditorState, cmd: Command, kind: 'do' | 'undo' | 'redo'): Partial<EditorState> {
  // The store centralises how commands transform the timeline so undo/redo can
  // replay the exact same mutation chain.
  switch (cmd.type) {
    case 'MOVE_CLIP': {
      const tracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips
          .filter((c) => (cmd.toTrackId ? c.id !== cmd.clipId || t.id !== cmd.fromTrackId : true))
          .map((c) => (c.id === cmd.clipId ? { ...c, startMs: kind === 'undo' ? cmd.fromMs : cmd.toMs } : c)),
      }));
      // If it moved to a different track, physically relocate it.
      if (cmd.toTrackId && cmd.toTrackId !== cmd.fromTrackId) {
        const moving = state.tracks.flatMap((t) => t.clips).find((c) => c.id === cmd.clipId);
        if (moving) {
          const dest = kind === 'undo' ? cmd.fromTrackId : cmd.toTrackId;
          return {
            tracks: tracks.map((t) =>
              t.id === dest
                ? {
                    ...t,
                    clips: [
                      ...t.clips.filter((c) => c.id !== cmd.clipId),
                      { ...moving, startMs: kind === 'undo' ? cmd.fromMs : cmd.toMs },
                    ],
                  }
                : t,
            ),
          };
        }
      }
      return { tracks };
    }
    case 'TRIM_CLIP': {
      const delta = kind === 'undo' ? -cmd.deltaMs : cmd.deltaMs;
      return {
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== cmd.clipId) return c;
            if (cmd.edge === 'start') {
              return {
                ...c,
                inMs: Math.max(0, c.inMs + delta),
                startMs: Math.max(0, c.startMs + delta),
                durationMs: Math.max(100, c.durationMs - delta),
              };
            }
            return {
              ...c,
              outMs: c.outMs + delta,
              durationMs: Math.max(100, c.durationMs + delta),
            };
          }),
        })),
      };
    }
    case 'CREATE_CLIP':
      if (kind === 'undo') {
        return {
          tracks: state.tracks.map((t) =>
            t.id === cmd.trackId ? { ...t, clips: t.clips.filter((c) => c.id !== cmd.clip.id) } : t,
          ),
        };
      }
      return {
        tracks: state.tracks.map((t) => (t.id === cmd.trackId ? { ...t, clips: [...t.clips, cmd.clip] } : t)),
      };
    case 'DELETE_CLIP':
      if (kind === 'undo') {
        return {
          tracks: state.tracks.map((t) => (t.id === cmd.trackId ? { ...t, clips: [...t.clips, cmd.clip] } : t)),
        };
      }
      return {
        tracks: state.tracks.map((t) =>
          t.id === cmd.trackId ? { ...t, clips: t.clips.filter((c) => c.id !== cmd.clip.id) } : t,
        ),
      };
    default:
      return {};
  }
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    projectId: null,
    title: '',
    aspectRatio: 'R9_16',
    durationMs: 0,
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    playheadMs: 0,
    playing: false,
    selectedClipId: null,
    selectedTrackId: null,
    tracks: [],
    dirty: false,
    history: emptyHistory,
    saveStatus: 'idle',
    lastSavedAt: null,
    activeJobs: {},

    hydrate: (input) =>
      set({
        ...input,
        dirty: false,
        history: emptyHistory,
        saveStatus: 'idle',
        lastSavedAt: Date.now(),
      }),

    setTitle: (title) => set({ title, dirty: true }),
    setAspectRatio: (aspectRatio) => set({ aspectRatio, dirty: true }),

    zoomIn: () => set((s) => ({ pxPerSecond: Math.min(s.pxPerSecond * 1.25, 200) })),
    zoomOut: () => set((s) => ({ pxPerSecond: Math.max(s.pxPerSecond / 1.25, 12) })),
    setZoom: (pxPerSecond) => set({ pxPerSecond }),

    setPlayhead: (playheadMs) => set({ playheadMs: Math.max(0, playheadMs) }),
    setPlaying: (playing) => set({ playing }),

    selectClip: (id) => set({ selectedClipId: id }),
    selectTrack: (id) => set({ selectedTrackId: id }),

    moveClip: (clipId, deltaMs, opts = { record: true }) => {
      const s = get();
      const clip = s.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
      if (!clip) return;
      const fromMs = clip.startMs;
      const toMs = Math.max(0, clip.startMs + deltaMs);
      const cmd: Command = { type: 'MOVE_CLIP', clipId, fromMs, toMs };
      set((prev) => ({
        ...applyCommand(prev, cmd, 'do'),
        history: opts.record ? push(prev.history, cmd) : prev.history,
        dirty: true,
      }));
    },

    trimClip: (clipId, edge, deltaMs, opts = { record: true }) => {
      const cmd: Command = { type: 'TRIM_CLIP', clipId, edge, deltaMs };
      set((prev) => ({
        ...applyCommand(prev, cmd, 'do'),
        history: opts.record ? push(prev.history, cmd) : prev.history,
        dirty: true,
      }));
    },

    splitClipAtPlayhead: () => {
      const { tracks, playheadMs } = get();
      let nextTracks = tracks;
      let didSplit = false;
      for (const t of tracks) {
        for (const c of t.clips) {
          if (playheadMs > c.startMs && playheadMs < c.startMs + c.durationMs) {
            const cutOffset = playheadMs - c.startMs;
            const left = { ...c, durationMs: cutOffset, outMs: c.inMs + cutOffset };
            const right: EditorClip = {
              ...c,
              id: `${c.id}-split-${Date.now()}`,
              startMs: playheadMs,
              durationMs: c.durationMs - cutOffset,
              inMs: c.inMs + cutOffset,
            };
            nextTracks = nextTracks.map((tr) =>
              tr.id === t.id
                ? { ...tr, clips: tr.clips.flatMap((x) => (x.id === c.id ? [left, right] : [x])) }
                : tr,
            );
            didSplit = true;
          }
        }
      }
      if (didSplit) set({ tracks: nextTracks, dirty: true });
    },

    deleteClip: (clipId) => {
      const s = get();
      const track = s.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      const clip = track?.clips.find((c) => c.id === clipId);
      if (!track || !clip) return;
      const cmd: Command = { type: 'DELETE_CLIP', clip, trackId: track.id, index: track.clips.indexOf(clip) };
      set((prev) => ({
        ...applyCommand(prev, cmd, 'do'),
        history: push(prev.history, cmd),
        selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
        dirty: true,
      }));
    },

    addClip: (trackKind, clip) => {
      const s = get();
      const targetTrack = s.tracks.find((t) => t.kind === trackKind);
      const trackId = targetTrack?.id ?? s.tracks[0]?.id;
      if (!trackId) throw new Error('No tracks to add a clip to');
      const trailing = targetTrack
        ? targetTrack.clips.reduce((m, c) => Math.max(m, c.startMs + c.durationMs), 0)
        : 0;
      const newClip: EditorClip = {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startMs: clip.startMs || trailing,
      };
      const cmd: Command = { type: 'CREATE_CLIP', trackId, clip: newClip };
      set((prev) => ({
        ...applyCommand(prev, cmd, 'do'),
        history: push(prev.history, cmd),
        dirty: true,
      }));
      return newClip;
    },

    addClipToVideoTrack: (clip) => {
      get().addClip('VIDEO', clip);
    },

    replaceClip: (clip) => {
      set((prev) => ({
        tracks: prev.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === clip.id ? clip : c)),
        })),
      }));
    },

    createTrack: (kind) => {
      const s = get();
      const sameKindCount = s.tracks.filter((t) => t.kind === kind).length;
      const track: EditorTrack = {
        id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind,
        index: sameKindCount,
        muted: false,
        locked: false,
        volume: 1,
        clips: [],
      };
      const cmd: Command = { type: 'CREATE_TRACK', track, index: s.tracks.length };
      set((prev) => ({
        tracks: [...prev.tracks, track],
        history: push(prev.history, cmd),
        dirty: true,
      }));
      return track;
    },

    removeTrack: (trackId) => {
      set((prev) => {
        const track = prev.tracks.find((t) => t.id === trackId);
        if (!track) return prev;
        const cmd: Command = { type: 'DELETE_TRACK', track, index: prev.tracks.indexOf(track) };
        return {
          tracks: prev.tracks.filter((t) => t.id !== trackId),
          history: push(prev.history, cmd),
          selectedTrackId: prev.selectedTrackId === trackId ? null : prev.selectedTrackId,
          selectedClipId: track.clips.some((c) => c.id === prev.selectedClipId)
            ? null
            : prev.selectedClipId,
          dirty: true,
        };
      });
    },

    toggleTrackMuted: (trackId) => {
      set((prev) => ({
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
        dirty: true,
      }));
    },

    toggleTrackLocked: (trackId) => {
      set((prev) => ({
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
        dirty: true,
      }));
    },

    undo: () => {
      const s = get();
      const { history, cmd } = undoHistory(s.history);
      if (!cmd) return;
      const inv = invert(cmd);
      set({ history, ...applyCommand(s, inv, 'undo'), dirty: true });
    },

    redo: () => {
      const s = get();
      const { history, cmd } = redoHistory(s.history);
      if (!cmd) return;
      set({ history, ...applyCommand(s, cmd, 'redo'), dirty: true });
    },

    markSaving: () => set({ saveStatus: 'saving' }),
    markSaved: () => set({ saveStatus: 'saved', dirty: false, lastSavedAt: Date.now() }),
    markError: () => set({ saveStatus: 'error' }),

    setJob: (jobId, info) => set((prev) => ({ activeJobs: { ...prev.activeJobs, [jobId]: info } })),
    clearJob: (jobId) =>
      set((prev) => {
        const { [jobId]: _, ...rest } = prev.activeJobs;
        return { activeJobs: rest };
      }),
  })),
);

/** Total duration of the timeline (rightmost clip end). */
export function selectTimelineDurationMs(s: EditorState): number {
  let max = 0;
  for (const t of s.tracks) {
    for (const c of t.clips) {
      max = Math.max(max, c.startMs + c.durationMs);
    }
  }
  return max;
}
