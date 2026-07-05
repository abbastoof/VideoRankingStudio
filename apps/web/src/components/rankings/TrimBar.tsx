'use client';

import { Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn, Slider } from '@vrs/ui';

import { MAX_SLOT_MS } from './ranking-layout';

export interface TrimBarProps {
  /** Full source duration in ms. */
  durationMs: number;
  trimStartMs: number | null;
  trimEndMs: number | null;
  volume: number;
  /** Fired on handle release — not per pointer-move. */
  onTrimChange: (startMs: number, endMs: number) => void;
  onVolumeChange: (volume: number) => void;
}

const MIN_SPAN_MS = 1000;

/**
 * Viblo-style trim ruler: green start / red end handles over a tick ruler,
 * "Start at" / "End at" chips, and a volume slider on the right.
 */
export function TrimBar({
  durationMs,
  trimStartMs,
  trimEndMs,
  volume,
  onTrimChange,
  onVolumeChange,
}: TrimBarProps) {
  const total = Math.max(durationMs, MIN_SPAN_MS);
  // Untrimmed default matches the effective slot the bake will produce:
  // the whole clip, capped at the per-slot maximum.
  const defaultEnd = Math.min(total, MAX_SLOT_MS);
  const [start, setStart] = useState(trimStartMs ?? 0);
  const [end, setEnd] = useState(trimEndMs ?? defaultEnd);
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  // Volume edits locally while dragging; the PATCH fires debounced so a
  // slider drag doesn't stampede the API. Release/blur commits immediately
  // so a Generate right after can't miss it.
  const [vol, setVol] = useState(volume);
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // latest = what the user last dragged to; committed = what the parent has.
  const latestVol = useRef(volume);
  const committedVol = useRef(volume);
  useEffect(() => {
    setVol(volume);
    latestVol.current = volume;
    committedVol.current = volume;
  }, [volume]);
  useEffect(
    () => () => {
      if (volTimer.current) clearTimeout(volTimer.current);
    },
    [],
  );
  function changeVolume(v: number) {
    setVol(v);
    latestVol.current = v;
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(commitVolume, 400);
  }
  function commitVolume() {
    if (volTimer.current) {
      clearTimeout(volTimer.current);
      volTimer.current = null;
    }
    if (latestVol.current !== committedVol.current) {
      committedVol.current = latestVol.current;
      onVolumeChange(latestVol.current);
    }
  }

  // Re-sync when the server state changes underneath (e.g. refresh).
  useEffect(() => {
    if (dragging.current) return;
    setStart(trimStartMs ?? 0);
    setEnd(trimEndMs ?? defaultEnd);
  }, [trimStartMs, trimEndMs, defaultEnd]);

  const msAtPointer = useCallback(
    (clientX: number): number => {
      const rail = railRef.current;
      if (!rail) return 0;
      const rect = rail.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(frac * total);
    },
    [total],
  );

  function beginDrag(which: 'start' | 'end') {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      dragging.current = which;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const ms = msAtPointer(ev.clientX);
        if (dragging.current === 'start') {
          setStart(Math.min(ms, endRef.current - MIN_SPAN_MS));
        } else {
          setEnd(Math.max(ms, startRef.current + MIN_SPAN_MS));
        }
      };
      const onUp = () => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        dragging.current = null;
        onTrimChange(clamp(startRef.current), clamp(endRef.current));
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    };
  }

  // Refs mirror state so pointer handlers read fresh values.
  const startRef = useRef(start);
  const endRef = useRef(end);
  startRef.current = start;
  endRef.current = end;

  const clamp = (ms: number) => Math.min(total, Math.max(0, ms));

  function nudge(which: 'start' | 'end', deltaMs: number) {
    if (which === 'start') {
      const next = Math.min(clamp(start + deltaMs), end - MIN_SPAN_MS);
      setStart(next);
      onTrimChange(next, end);
    } else {
      const next = Math.max(clamp(end + deltaMs), start + MIN_SPAN_MS);
      setEnd(next);
      onTrimChange(start, next);
    }
  }

  const ticks = buildTicks(total);
  const startPct = (start / total) * 100;
  const endPct = (end / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            Start at
            <strong className="font-mono">{fmtSeconds(start)}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-sm bg-danger" aria-hidden />
            End at
            <strong className="font-mono">{fmtSeconds(end)}</strong>
          </span>
        </div>
        <div className="flex w-44 items-center gap-2">
          <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Slider
            aria-label="Clip volume"
            min={0}
            max={1}
            step={0.05}
            value={vol}
            onValueChange={changeVolume}
            onPointerUp={commitVolume}
            onBlur={commitVolume}
          />
        </div>
      </div>

      <div className="px-1.5">
        <div ref={railRef} className="relative h-12 select-none">
          {/* Ruler */}
          <div className="absolute inset-x-0 top-3 h-px bg-border-strong" aria-hidden />
          {ticks.map((t) => (
            <div
              key={t.ms}
              className="absolute top-3"
              style={{ left: `${(t.ms / total) * 100}%` }}
              aria-hidden
            >
              <div className={cn('w-px bg-border-strong', t.major ? 'h-2.5' : 'h-1.5')} />
              {t.major ? (
                <div className="-translate-x-1/2 pt-0.5 font-mono text-[10px] text-muted-foreground">
                  {fmtSeconds(t.ms)}
                </div>
              ) : null}
            </div>
          ))}

          {/* Selected span */}
          <div
            className="absolute top-2.5 h-1.5 rounded-full bg-brand-400/40"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            aria-hidden
          />

          {/* Handles */}
          <TrimHandle
            kind="start"
            pct={startPct}
            ms={start}
            totalMs={total}
            onPointerDown={beginDrag('start')}
            onNudge={(d) => nudge('start', d)}
          />
          <TrimHandle
            kind="end"
            pct={endPct}
            ms={end}
            totalMs={total}
            onPointerDown={beginDrag('end')}
            onNudge={(d) => nudge('end', d)}
          />
        </div>
      </div>
    </div>
  );
}

function TrimHandle({
  kind,
  pct,
  ms,
  totalMs,
  onPointerDown,
  onNudge,
}: {
  kind: 'start' | 'end';
  pct: number;
  ms: number;
  totalMs: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onNudge: (deltaMs: number) => void;
}) {
  return (
    <button
      type="button"
      role="slider"
      aria-label={kind === 'start' ? 'Trim start' : 'Trim end'}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs / 1000)}
      aria-valuenow={Math.round(ms / 1000)}
      aria-valuetext={fmtSeconds(ms)}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNudge(e.shiftKey ? -1000 : -100);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNudge(e.shiftKey ? 1000 : 100);
        }
      }}
      className={cn(
        'absolute top-0 z-10 -translate-x-1/2 cursor-ew-resize touch-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded',
      )}
      style={{ left: `${pct}%` }}
    >
      <span
        className={cn(
          'block h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent',
          kind === 'start' ? 'border-t-success' : 'border-t-danger',
        )}
        aria-hidden
      />
      <span
        className={cn('mx-auto block h-9 w-0.5', kind === 'start' ? 'bg-success' : 'bg-danger')}
        aria-hidden
      />
    </button>
  );
}

function buildTicks(totalMs: number): Array<{ ms: number; major: boolean }> {
  // Aim for a major tick every ~10 ticks, majors at "nice" second values.
  const targetTicks = 40;
  const rawStep = totalMs / targetTicks;
  const step = niceStep(rawStep);
  const ticks: Array<{ ms: number; major: boolean }> = [];
  for (let ms = 0, i = 0; ms <= totalMs; ms += step, i += 1) {
    ticks.push({ ms: Math.round(ms), major: i % 10 === 0 });
  }
  return ticks;
}

function niceStep(raw: number): number {
  const steps = [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000];
  return steps.find((s) => s >= raw) ?? 60_000;
}

function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
