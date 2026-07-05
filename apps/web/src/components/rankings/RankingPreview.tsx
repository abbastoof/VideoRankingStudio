'use client';

import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RankingDetail } from '@vrs/sdk';
import { cn } from '@vrs/ui';

import { fontCssFor } from '@/lib/fonts';

import { computeLayout, DEFAULT_TITLE_STYLE, slotDurationMs } from './ranking-layout';

/**
 * Live phone-frame preview of the ranking composition.
 *
 * The composition renders on a fixed 1080-wide design canvas that is
 * CSS-scaled to the frame, so every font size and position matches the
 * worker's rasterizer 1:1. Slots follow the reveal order (countdown plays
 * last place first), auto-advance, and honor per-candidate trim + volume.
 */
export function RankingPreview({
  ranking,
  onMediaError,
}: {
  ranking: RankingDetail;
  /** Fired when a clip fails to load (e.g. presigned URL expired). */
  onMediaError?: () => void;
}) {
  const design = useMemo(() => designSize(ranking.aspectRatio), [ranking.aspectRatio]);
  const layout = computeLayout(ranking);

  // Playback order mirrors the bake: countdown = reversed list.
  const slots = useMemo(() => {
    const ordered =
      ranking.reveal === 'topfirst' ? ranking.candidates : [...ranking.candidates].reverse();
    return ordered.map((candidate, i) => ({
      candidate,
      rank:
        ranking.reveal === 'topfirst' ? i + 1 : ranking.candidates.length - i,
      durationMs: slotDurationMs(candidate),
    }));
  }, [ranking.candidates, ranking.reveal]);

  const [slotIndex, setSlotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [slotElapsedMs, setSlotElapsedMs] = useState(0);

  const safeIndex = Math.min(slotIndex, Math.max(0, slots.length - 1));
  const active = slots[safeIndex];
  const totalMs = slots.reduce((sum, s) => sum + s.durationMs, 0);
  const elapsedMs =
    slots.slice(0, safeIndex).reduce((sum, s) => sum + s.durationMs, 0) +
    Math.min(slotElapsedMs, active?.durationMs ?? 0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // `timeupdate` at the trim end and `ended` can both fire for the same
  // slot — guard so a slot advances exactly once.
  const advancedRef = useRef(false);
  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setSlotElapsedMs(0);
    setSlotIndex((i) => {
      if (i + 1 < slots.length) return i + 1;
      setPlaying(false);
      return 0;
    });
  }, [slots.length]);
  useEffect(() => {
    advancedRef.current = false;
  }, [safeIndex]);

  // Timer drives videoless slots and the elapsed readout.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playing || !active) return;
    const hasVideo = Boolean(active.candidate.assetUrl);
    const startedAt = Date.now() - slotElapsedMs;
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAt;
      if (hasVideo) {
        // Video's timeupdate owns advancement; timer only refreshes elapsed.
        const v = videoRef.current;
        if (v) {
          const trimStart = active.candidate.trimStartMs ?? 0;
          setSlotElapsedMs(Math.max(0, v.currentTime * 1000 - trimStart));
        }
        return;
      }
      if (ms >= active.durationMs) {
        advance();
      } else {
        setSlotElapsedMs(ms);
      }
    }, 200);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slotElapsedMs seeds the timer; re-running per tick would reset it
  }, [playing, safeIndex, active?.candidate.id, advance]);

  // Video element control: seek to trim start, play/pause, stop at trim end.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;
    const trimStart = (active.candidate.trimStartMs ?? 0) / 1000;
    const trimEnd = trimStart + active.durationMs / 1000;

    if (playing) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      void v.play().catch(() => setPlaying(false));
    } else {
      v.pause();
    }

    const onTime = () => {
      if (v.currentTime >= trimEnd) {
        v.pause();
        advance();
      }
    };
    const onEnded = () => advance();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [playing, safeIndex, active, advance]);

  // React doesn't reliably sync the `muted` attribute after initial render
  // (facebook/react#10389) — set the property directly. Volume mirrors the
  // candidate's clip volume the same way the export mixes it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = Math.min(1, Math.max(0, active?.candidate.volume ?? 1));
  }, [muted, safeIndex, active?.candidate.volume]);

  // Measure the frame so the design canvas can scale to fit.
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setFrameWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = frameWidth > 0 ? frameWidth / design.w : 0;

  const headerStyle = { ...DEFAULT_TITLE_STYLE, ...(ranking.titleStyle ?? {}) };
  const brand = ranking.brandColor ?? '#f97316';

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-[28px] border-8 border-black bg-black shadow-floating"
        style={{ aspectRatio: `${design.w} / ${design.h}` }}
        aria-label="Ranking preview"
      >
        {scale > 0 ? (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: design.w,
              height: design.h,
              transform: `scale(${scale})`,
              backgroundColor: ranking.backgroundColor || '#2b2a2a',
            }}
          >
            {/* Video block */}
            {active?.candidate.assetUrl ? (
              <div
                className="absolute left-0 flex w-full items-center justify-center"
                style={{
                  top: `${layout.videoTopPct}%`,
                  height: `${layout.videoHeightPct}%`,
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- preview of raw source clip */}
                <video
                  ref={videoRef}
                  key={active.candidate.id}
                  src={active.candidate.assetUrl}
                  poster={active.candidate.thumbnailUrl ?? undefined}
                  muted={muted}
                  playsInline
                  preload="metadata"
                  onError={onMediaError}
                  className="max-h-full max-w-full"
                />
              </div>
            ) : null}

            {/* Rank number */}
            {active ? (
              <div
                className="absolute select-none leading-none"
                style={{
                  left: `${layout.numberXPct}%`,
                  top: `${layout.numberYPct}%`,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: fontCssFor('Archivo Black'),
                  fontSize: layout.numberFontSize,
                  color: brand,
                  textShadow: strokeShadow(10, '#000000'),
                }}
                aria-hidden
              >
                {active.rank}.
              </div>
            ) : null}

            {/* Ranking title. Wrap margin (5%) and the single block-level
                pill (pad 0.35em, radius 0.25em) mirror the rasterizer's
                geometry so preview and export match. */}
            {ranking.headerText ? (
              <div
                className="absolute w-full select-none text-center leading-[1.25]"
                style={{
                  top: `${headerStyle.yPct ?? layout.headerYPct}%`,
                  transform: 'translateY(-50%)',
                  paddingLeft: '5%',
                  paddingRight: '5%',
                  fontFamily: fontCssFor(headerStyle.fontFamily),
                  fontSize: headerStyle.fontSize,
                  fontWeight: headerStyle.bold === false ? 400 : 800,
                  fontStyle: headerStyle.italic ? 'italic' : undefined,
                  color: headerStyle.color,
                  textShadow:
                    headerStyle.strokeWidth > 0
                      ? strokeShadow(headerStyle.strokeWidth, headerStyle.strokeColor)
                      : undefined,
                }}
                aria-hidden
              >
                <span
                  style={
                    headerStyle.background
                      ? {
                          display: 'inline-block',
                          backgroundColor: headerStyle.background,
                          borderRadius: '0.25em',
                          padding: '0.35em',
                        }
                      : undefined
                  }
                >
                  {ranking.headerText}
                </span>
              </div>
            ) : null}

            {/* Candidate title */}
            {active?.candidate.title ? (
              <div
                className="absolute w-full select-none text-center leading-[1.25]"
                style={{
                  top: `${layout.candidateTitleYPct}%`,
                  transform: 'translateY(-50%)',
                  paddingLeft: '5%',
                  paddingRight: '5%',
                  fontFamily: fontCssFor('Rubik'),
                  fontSize: layout.candidateTitleFontSize,
                  fontWeight: 500,
                  color: '#ffffff',
                }}
                aria-hidden
              >
                {active.candidate.title}
                {active.candidate.subtitle ? (
                  <div style={{ fontSize: layout.candidateTitleFontSize * 0.7, opacity: 0.85 }}>
                    {active.candidate.subtitle}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Empty state */}
            {slots.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center px-16 text-center">
                <p className="text-4xl text-white/50">
                  Add a video below to see your ranking come to life
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Player controls */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-6">
          <ControlButton
            label={playing ? 'Pause preview' : 'Play preview'}
            onClick={() => setPlaying((p) => !p)}
            disabled={slots.length === 0}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </ControlButton>
          <ControlButton
            label={muted ? 'Unmute preview' : 'Mute preview'}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </ControlButton>
          <span className="ml-1 font-mono text-xs text-white/90">
            {fmtClock(elapsedMs)} / {fmtClock(totalMs)}
          </span>
          <span className="flex-1" />
          {slots.length > 1 ? (
            <>
              <ControlButton
                label="Previous video"
                onClick={() => {
                  setSlotElapsedMs(0);
                  setSlotIndex((i) => Math.max(0, i - 1));
                }}
                disabled={safeIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </ControlButton>
              <span className="font-mono text-xs text-white/90">
                {safeIndex + 1}/{slots.length}
              </span>
              <ControlButton
                label="Next video"
                onClick={() => {
                  setSlotElapsedMs(0);
                  setSlotIndex((i) => Math.min(slots.length - 1, i + 1));
                }}
                disabled={safeIndex === slots.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </ControlButton>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-full text-white transition-colors hover:bg-white/15',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/** 8-direction text shadow approximating the export's outer stroke. */
function strokeShadow(width: number, color: string): string {
  const w = Math.max(1, Math.round(width * 0.6));
  const dirs = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  return dirs.map(([x, y]) => `${x! * w}px ${y! * w}px 0 ${color}`).join(', ');
}

function designSize(aspect: string): { w: number; h: number } {
  return (
    {
      R9_16: { w: 1080, h: 1920 },
      R1_1: { w: 1080, h: 1080 },
      R4_5: { w: 1080, h: 1350 },
      R16_9: { w: 1920, h: 1080 },
    }[aspect as 'R9_16' | 'R1_1' | 'R4_5' | 'R16_9'] ?? { w: 1080, h: 1920 }
  );
}

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
