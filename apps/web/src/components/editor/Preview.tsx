'use client';

import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@vrs/ui';

import { fontCssFor } from '@/lib/fonts';
import { strokeShadow } from '@/lib/text-style';
import { selectTimelineDurationMs, useEditorStore } from '@/state/editor-store';

/**
 * Preview pane. For MVP this picks the active video clip at the playhead and
 * plays its underlying source through an HTML5 <video> element, scrubbing the
 * source's currentTime as the timeline playhead moves. A real compositor
 * (canvas-based multi-track + caption burn-in) replaces this in a later
 * milestone — the surface stays the same.
 */
export function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const playing = useEditorStore((s) => s.playing);
  const totalMs = useEditorStore(selectTimelineDurationMs);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);

  const tracks = useEditorStore((s) => s.tracks);
  const [muted, setMuted] = useState(false);

  // Find the video clip at the current playhead.
  const activeClip = tracks
    .filter((t) => t.kind === 'VIDEO')
    .flatMap((t) => t.clips)
    .find((c) => playheadMs >= c.startMs && playheadMs < c.startMs + c.durationMs);

  // Drive the underlying <video>'s time from the playhead.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    const target = (activeClip.inMs + (playheadMs - activeClip.startMs) * activeClip.speed) / 1000;
    if (Math.abs(v.currentTime - target) > 0.2) {
      v.currentTime = Math.max(0, target);
    }
  }, [playheadMs, activeClip]);

  // Tick the playhead while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = useEditorStore.getState().playheadMs + dt;
      if (next >= Math.max(totalMs, 1000)) {
        setPlaying(false);
        setPlayhead(0);
        return;
      }
      setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs, setPlaying, setPlayhead]);

  // Play / pause the underlying media element in lockstep.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [playing, activeClip?.id]);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }

  return (
    <div className="flex-1 grid place-items-center p-6 bg-surface-muted/30">
      <div
        ref={containerRef}
        className={cn(
          'relative bg-black rounded-lg overflow-hidden shadow-elevation flex items-center justify-center',
          aspectClass(aspectRatio),
        )}
      >
        {activeClip?.previewUrl ? (
          <video
            ref={videoRef}
            src={activeClip.previewUrl}
            muted={muted}
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <PreviewEmpty />
        )}
        {/* Text overlays from OVERLAY tracks (baked rankings, titles). */}
        <OverlayLayer />
        {/* Active caption overlay (MVP: render the most recent caption block) */}
        <CaptionOverlay />
      </div>

      <PreviewControls
        playing={playing}
        muted={muted}
        playheadMs={playheadMs}
        totalMs={totalMs}
        onTogglePlay={() => setPlaying(!playing)}
        onToggleMute={() => setMuted((m) => !m)}
        onFullscreen={toggleFullscreen}
      />
    </div>
  );
}

function aspectClass(a: string): string {
  return (
    {
      R9_16: 'aspect-[9/16] max-h-[60vh]',
      R16_9: 'aspect-video w-full max-w-3xl',
      R1_1: 'aspect-square max-h-[60vh]',
      R4_5: 'aspect-[4/5] max-h-[60vh]',
    }[a] ?? 'aspect-[9/16] max-h-[60vh]'
  );
}

function PreviewEmpty() {
  return (
    <div className="text-center text-muted-foreground space-y-2 p-6">
      <p className="text-sm">Nothing on the timeline yet.</p>
      <p className="text-xs opacity-80">Add a clip from the sidebar to see a preview.</p>
    </div>
  );
}

/**
 * Renders TEXT clips on OVERLAY tracks at the playhead. Positions and font
 * sizes are design-space (1080-wide portrait / 1920-wide landscape canvas),
 * scaled to the rendered box via a ResizeObserver — the same approach as the
 * ranking builder's phone preview, so baked rankings look right here too.
 */
function OverlayLayer() {
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const overlayTracks = useEditorStore((s) => s.tracks.filter((t) => t.kind === 'OVERLAY'));

  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setBoxWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const designWidth = aspectRatio === 'R16_9' ? 1920 : 1080;
  const scale = boxWidth > 0 ? boxWidth / designWidth : 0;

  const active = overlayTracks
    .flatMap((t) => t.clips)
    .filter(
      (c) =>
        c.text?.value && playheadMs >= c.startMs && playheadMs < c.startMs + c.durationMs,
    );

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {scale > 0
        ? active.map((clip) => {
            const t = clip.text!;
            const size = (t.size ?? 48) * scale;
            const stroke = t.strokeWidth ?? 0;
            return (
              <div
                key={clip.id}
                className="absolute w-full select-none text-center leading-[1.25]"
                style={{
                  top: `${t.yPct ?? 50}%`,
                  transform: 'translateY(-50%)',
                  paddingLeft: t.xPct == null ? '5%' : 0,
                  paddingRight: t.xPct == null ? '5%' : 0,
                  ...(t.xPct != null
                    ? { left: `${t.xPct}%`, width: 'auto', transform: 'translate(-50%, -50%)' }
                    : {}),
                  textAlign: t.align ?? 'center',
                  fontFamily: fontCssFor(t.fontFamily ?? 'Inter'),
                  fontSize: size,
                  fontWeight: t.fontWeight ?? 700,
                  fontStyle: t.italic ? 'italic' : undefined,
                  color: t.color ?? '#ffffff',
                  textShadow: stroke > 0 ? strokeShadow(stroke * scale, t.strokeColor ?? '#000') : undefined,
                }}
              >
                <span
                  style={{
                    whiteSpace: 'pre-line',
                    ...(t.background
                      ? {
                          display: 'inline-block',
                          backgroundColor: t.background,
                          borderRadius: '0.25em',
                          padding: '0.35em',
                        }
                      : {}),
                  }}
                >
                  {t.value}
                </span>
              </div>
            );
          })
        : null}
    </div>
  );
}

function CaptionOverlay() {
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const captionTrack = useEditorStore((s) => s.tracks.find((t) => t.kind === 'CAPTION'));
  if (!captionTrack) return null;
  const active = captionTrack.clips.find((c) => playheadMs >= c.startMs && playheadMs < c.startMs + c.durationMs);
  if (!active?.text?.value) return null;
  return (
    <div className="absolute bottom-8 left-0 right-0 px-6 text-center pointer-events-none">
      <span
        className="inline-block rounded px-3 py-1 text-white text-base font-bold"
        style={{
          background: active.text.background ?? 'rgba(0,0,0,0.6)',
          color: active.text.color ?? '#fff',
          fontSize: active.text.size ?? 24,
        }}
      >
        {active.text.value}
      </span>
    </div>
  );
}

function PreviewControls({
  playing,
  muted,
  playheadMs,
  totalMs,
  onTogglePlay,
  onToggleMute,
  onFullscreen,
}: {
  playing: boolean;
  muted: boolean;
  playheadMs: number;
  totalMs: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="mt-4 w-full max-w-md mx-auto flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
        className="h-9 w-9 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {fmtTime(playheadMs)} / {fmtTime(totalMs)}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="text-muted-foreground hover:text-foreground"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onFullscreen}
        aria-label="Fullscreen"
        className="text-muted-foreground hover:text-foreground"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
