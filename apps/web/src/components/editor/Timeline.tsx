'use client';

import { Lock, Mic2, Music, Type, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';

import { cn } from '@vrs/ui';

import { selectTimelineDurationMs, useEditorStore, type EditorClip, type EditorTrack } from '@/state/editor-store';

const TRACK_HEIGHT = 56;
const HEADER_WIDTH = 130;
const RULER_HEIGHT = 24;

export function Timeline() {
  const tracks = useEditorStore((s) => s.tracks);
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const pxPerSecond = useEditorStore((s) => s.pxPerSecond);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const totalMs = useEditorStore(selectTimelineDurationMs);

  const scrollRef = useRef<HTMLDivElement>(null);
  const widthPx = (Math.max(totalMs, 30_000) / 1000) * pxPerSecond + 200;

  function handleRulerClick(e: ReactPointerEvent<HTMLDivElement>) {
    const bounds = scrollRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = e.clientX - bounds.left - HEADER_WIDTH + (scrollRef.current?.scrollLeft ?? 0);
    setPlayhead((x / pxPerSecond) * 1000);
  }

  return (
    <div className="border-t border-border bg-surface-muted/40 select-none">
      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden" style={{ maxHeight: 320 }}>
        <div style={{ width: widthPx + HEADER_WIDTH, position: 'relative' }}>
          <Ruler
            widthPx={widthPx}
            pxPerSecond={pxPerSecond}
            onClick={handleRulerClick}
          />
          <Playhead
            offsetPx={HEADER_WIDTH + (playheadMs / 1000) * pxPerSecond}
            heightPx={tracks.length * TRACK_HEIGHT + RULER_HEIGHT}
          />
          {tracks
            .slice()
            .sort((a, b) => trackKindWeight(a.kind) - trackKindWeight(b.kind))
            .map((t) => (
              <TrackLane
                key={t.id}
                track={t}
                widthPx={widthPx}
                pxPerSecond={pxPerSecond}
                selectedClipId={selectedClipId}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function trackKindWeight(k: EditorTrack['kind']): number {
  return { CAPTION: 0, VIDEO: 1, OVERLAY: 2, AUDIO: 3 }[k] ?? 99;
}

function Ruler({
  widthPx,
  pxPerSecond,
  onClick,
}: {
  widthPx: number;
  pxPerSecond: number;
  onClick: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const ticks = useMemo(() => {
    const secondsPerMajor = pxPerSecond < 25 ? 10 : pxPerSecond < 60 ? 5 : 1;
    const total = Math.ceil(widthPx / pxPerSecond);
    return Array.from({ length: Math.ceil(total / secondsPerMajor) + 1 }, (_, i) => i * secondsPerMajor);
  }, [widthPx, pxPerSecond]);

  return (
    <div className="sticky top-0 z-10 flex">
      <div
        className="bg-surface border-r border-border text-xs text-muted-foreground flex items-center justify-end px-2"
        style={{ width: HEADER_WIDTH, height: RULER_HEIGHT }}
      >
        00:00
      </div>
      <div
        className="relative bg-surface-muted border-b border-border cursor-pointer"
        style={{ width: widthPx, height: RULER_HEIGHT }}
        onPointerDown={onClick}
      >
        {ticks.map((s) => (
          <div
            key={s}
            className="absolute top-0 bottom-0 border-l border-border-strong/70 text-2xs text-muted-foreground"
            style={{ left: s * pxPerSecond }}
          >
            <span className="absolute top-1 left-1 font-mono">{formatTime(s)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Playhead({ offsetPx, heightPx }: { offsetPx: number; heightPx: number }) {
  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left: offsetPx, height: heightPx }}
    >
      <div className="h-3 w-3 -ml-1.5 -mt-1 rotate-45 bg-brand-500 shadow" />
      <div className="w-px h-full bg-brand-500/80" />
    </div>
  );
}

function TrackLane({
  track,
  widthPx,
  pxPerSecond,
  selectedClipId,
}: {
  track: EditorTrack;
  widthPx: number;
  pxPerSecond: number;
  selectedClipId: string | null;
}) {
  return (
    <div className="flex border-t border-border" style={{ height: TRACK_HEIGHT }}>
      <TrackHeader track={track} />
      <div
        className="relative flex-1 bg-background"
        style={{ width: widthPx }}
      >
        {track.clips.map((c) => (
          <ClipBlock
            key={c.id}
            clip={c}
            pxPerSecond={pxPerSecond}
            selected={c.id === selectedClipId}
            kind={track.kind}
          />
        ))}
      </div>
    </div>
  );
}

function TrackHeader({ track }: { track: EditorTrack }) {
  const Icon = trackIcon(track.kind);
  return (
    <div
      className="bg-surface border-r border-border flex items-center gap-2 px-3"
      style={{ width: HEADER_WIDTH }}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium capitalize truncate">{track.kind.toLowerCase()}</p>
        <p className="text-2xs text-muted-foreground">Track {track.index + 1}</p>
      </div>
      {track.locked ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
    </div>
  );
}

function trackIcon(kind: EditorTrack['kind']) {
  switch (kind) {
    case 'VIDEO': return Video;
    case 'AUDIO': return Music;
    case 'CAPTION': return Type;
    case 'OVERLAY': return Mic2;
    default: return Video;
  }
}

function ClipBlock({
  clip,
  pxPerSecond,
  selected,
  kind,
}: {
  clip: EditorClip;
  pxPerSecond: number;
  selected: boolean;
  kind: EditorTrack['kind'];
}) {
  const moveClip = useEditorStore((s) => s.moveClip);
  const trimClip = useEditorStore((s) => s.trimClip);
  const selectClip = useEditorStore((s) => s.selectClip);

  const left = (clip.startMs / 1000) * pxPerSecond;
  const width = Math.max(8, (clip.durationMs / 1000) * pxPerSecond);

  const dragState = useRef<{ mode: 'move' | 'trim-start' | 'trim-end'; startX: number; startMs: number; startDuration: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, mode: 'move' | 'trim-start' | 'trim-end') {
    e.stopPropagation();
    selectClip(clip.id);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode,
      startX: e.clientX,
      startMs: clip.startMs,
      startDuration: clip.durationMs,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragState.current;
    if (!s) return;
    const dxPx = e.clientX - s.startX;
    const dxMs = (dxPx / pxPerSecond) * 1000;
    if (s.mode === 'move') moveClip(clip.id, dxMs - (clip.startMs - s.startMs));
    if (s.mode === 'trim-start') trimClip(clip.id, 'start', dxMs - (clip.startMs - s.startMs));
    if (s.mode === 'trim-end') trimClip(clip.id, 'end', dxMs - (clip.durationMs - s.startDuration));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
  }

  const palette = kind === 'VIDEO'
    ? 'bg-brand-500/70 hover:bg-brand-500 border-brand-700'
    : kind === 'AUDIO'
    ? 'bg-info/60 hover:bg-info/80 border-info'
    : kind === 'CAPTION'
    ? 'bg-success/60 hover:bg-success/80 border-success'
    : 'bg-warning/60 hover:bg-warning/80 border-warning';

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 rounded-md border-2 text-2xs cursor-grab active:cursor-grabbing flex items-center px-2 overflow-hidden',
        palette,
        selected && 'ring-2 ring-brand-300 ring-offset-1 ring-offset-background',
      )}
      style={{ left, width }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="button"
      tabIndex={0}
      aria-label={`Clip ${clip.id}`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30"
        onPointerDown={(e) => onPointerDown(e, 'trim-start')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <span className="font-medium text-foreground/90 truncate flex-1">
        {clip.text?.value ?? clipLabel(clip)}
      </span>
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30"
        onPointerDown={(e) => onPointerDown(e, 'trim-end')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}

function clipLabel(c: EditorClip): string {
  if (c.source === 'VOICEOVER') return 'Voiceover';
  if (c.source === 'GENERATED_IMAGE') return 'AI image';
  if (c.source === 'GENERATED_VIDEO') return 'AI video';
  if (c.source === 'TEXT') return 'Text';
  return 'Clip';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function useKeyboardShortcuts() {
  const store = useEditorStore;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT' || (e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
      const s = store.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        // save handled by parent
      } else if (e.key === 'b') {
        // split at playhead
        s.splitClipAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedClipId) s.deleteClip(s.selectedClipId);
      } else if (e.key === '+' || e.key === '=') {
        s.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        s.zoomOut();
      } else if (e.key === 'ArrowLeft') {
        s.setPlayhead(s.playheadMs - (e.shiftKey ? 5000 : 100));
      } else if (e.key === 'ArrowRight') {
        s.setPlayhead(s.playheadMs + (e.shiftKey ? 5000 : 100));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
