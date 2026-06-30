'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { ProjectAspectRatio } from '@vrs/types';

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
  text?: { value: string; color?: string; background?: string; size?: number };
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

  hydrate: (input: Partial<EditorState> & Pick<EditorState, 'projectId' | 'tracks'>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (px: number) => void;
  setPlayhead: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  selectClip: (id: string | null) => void;
  selectTrack: (id: string | null) => void;
  moveClip: (clipId: string, deltaMs: number) => void;
  trimClip: (clipId: string, edge: 'start' | 'end', deltaMs: number) => void;
  splitClipAtPlayhead: () => void;
  deleteClip: (clipId: string) => void;
  addClipToVideoTrack: (clip: Omit<EditorClip, 'id'>) => void;
}

const DEFAULT_PX_PER_SECOND = 50;

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

    hydrate: (input) => set({ ...input, dirty: false }),

    zoomIn: () => set((s) => ({ pxPerSecond: Math.min(s.pxPerSecond * 1.25, 200) })),
    zoomOut: () => set((s) => ({ pxPerSecond: Math.max(s.pxPerSecond / 1.25, 12) })),
    setZoom: (pxPerSecond) => set({ pxPerSecond }),

    setPlayhead: (playheadMs) => set({ playheadMs: Math.max(0, playheadMs) }),
    setPlaying: (playing) => set({ playing }),

    selectClip: (id) => set({ selectedClipId: id }),
    selectTrack: (id) => set({ selectedTrackId: id }),

    moveClip: (clipId, deltaMs) =>
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, startMs: Math.max(0, c.startMs + deltaMs) } : c,
          ),
        })),
        dirty: true,
      })),

    trimClip: (clipId, edge, deltaMs) =>
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c;
            if (edge === 'start') {
              const newIn = Math.max(0, c.inMs + deltaMs);
              const newDuration = Math.max(100, c.durationMs - deltaMs);
              const newStart = Math.max(0, c.startMs + deltaMs);
              return { ...c, inMs: newIn, startMs: newStart, durationMs: newDuration };
            }
            const newOut = c.outMs + deltaMs;
            const newDuration = Math.max(100, c.durationMs + deltaMs);
            return { ...c, outMs: newOut, durationMs: newDuration };
          }),
        })),
        dirty: true,
      })),

    splitClipAtPlayhead: () => {
      const { tracks, playheadMs } = get();
      const newTracks = tracks.map((t) => {
        const newClips: EditorClip[] = [];
        for (const c of t.clips) {
          if (playheadMs > c.startMs && playheadMs < c.startMs + c.durationMs) {
            const cutOffset = playheadMs - c.startMs;
            const left: EditorClip = {
              ...c,
              durationMs: cutOffset,
              outMs: c.inMs + cutOffset,
            };
            const right: EditorClip = {
              ...c,
              id: `${c.id}-split-${Date.now()}`,
              startMs: playheadMs,
              durationMs: c.durationMs - cutOffset,
              inMs: c.inMs + cutOffset,
            };
            newClips.push(left, right);
          } else {
            newClips.push(c);
          }
        }
        return { ...t, clips: newClips };
      });
      set({ tracks: newTracks, dirty: true });
    },

    deleteClip: (clipId) =>
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        })),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
        dirty: true,
      })),

    addClipToVideoTrack: (clip) => {
      set((s) => {
        const videoTrack = s.tracks.find((t) => t.kind === 'VIDEO');
        if (!videoTrack) return s;
        const trailing = videoTrack.clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);
        const newClip: EditorClip = {
          ...clip,
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          startMs: trailing,
        };
        return {
          tracks: s.tracks.map((t) =>
            t.id === videoTrack.id ? { ...t, clips: [...t.clips, newClip] } : t,
          ),
          dirty: true,
        };
      });
    },
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
