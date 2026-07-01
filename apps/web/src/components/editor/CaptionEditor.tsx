'use client';

import { AlignCenter, AlignLeft, AlignRight, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Spinner } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface TranscriptSegment {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel: string | null;
}

interface Transcript {
  id: string;
  language: string;
  status: string;
  durationMs: number;
  srtUrl: string | null;
  vttUrl: string | null;
  segments: TranscriptSegment[];
}

interface CaptionStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  background?: string | null;
  position?: 'top' | 'middle' | 'bottom';
  animation?: 'none' | 'word-by-word' | 'fade-in' | 'pop' | 'kinetic';
  outline?: { color: string; width: number };
}

/**
 * Editable caption workspace. Fetches the latest transcript, renders each
 * segment as a compact row with in-line time + text editing, and syncs
 * mutations back through the SDK. A side panel exposes the style knobs that
 * the FFmpeg compose graph reads back at render time.
 */
export function CaptionEditor({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [current, setCurrent] = useState<Transcript | null>(null);
  const [captionId, setCaptionId] = useState<string | null>(null);
  const [style, setStyle] = useState<CaptionStyle>({
    fontFamily: 'Inter',
    fontSize: 44,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.55)',
    position: 'bottom',
    animation: 'word-by-word',
    outline: { color: '#000000', width: 2 },
  });
  const [dirtySegments, setDirtySegments] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ts, caps] = await Promise.all([
        clientSdk().listTranscripts(projectId),
        clientSdk().listCaptions(projectId),
      ]);
      if (cancelled) return;
      setTranscripts(ts as Transcript[]);
      setCurrent((ts as Transcript[])[0] ?? null);
      const captions = caps.items as Array<{ id: string; styleJson: CaptionStyle }>;
      if (captions[0]) {
        setCaptionId(captions[0].id);
        setStyle({ ...style, ...captions[0].styleJson });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function updateSegmentLocal(id: string, patch: Partial<TranscriptSegment>) {
    if (!current) return;
    setCurrent({
      ...current,
      segments: current.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
    setDirtySegments((prev) => new Set(prev).add(id));
  }

  async function flushSegment(seg: TranscriptSegment) {
    if (!current || !dirtySegments.has(seg.id)) return;
    await clientSdk().updateTranscriptSegment(projectId, current.id, seg.id, {
      text: seg.text,
      startMs: seg.startMs,
      endMs: seg.endMs,
    });
    setDirtySegments((prev) => {
      const next = new Set(prev);
      next.delete(seg.id);
      return next;
    });
  }

  async function deleteSegment(id: string) {
    if (!current) return;
    await clientSdk().deleteTranscriptSegment(projectId, current.id, id);
    setCurrent({ ...current, segments: current.segments.filter((s) => s.id !== id) });
  }

  async function saveStyle() {
    if (!current) return;
    setSaving(true);
    try {
      const segments = current.segments.map((s) => ({
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      }));
      if (captionId) {
        await clientSdk().updateCaption(projectId, captionId, {
          styleJson: style as never,
          segmentsJson: segments,
        });
      } else {
        const created = (await clientSdk().createCaption(projectId, {
          name: 'Captions',
          transcriptId: current.id,
          styleJson: style as never,
          segments,
        })) as { id: string };
        setCaptionId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 grid place-items-center">
        <Spinner label="Loading captions" />
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <Sparkles className="mx-auto h-6 w-6 text-brand-500" />
        <h3 className="text-lg font-semibold">No transcript yet</h3>
        <p className="text-sm text-muted-foreground">
          Run auto captions from the Captions tool in the sidebar. Once the
          transcript finishes, this workspace fills in automatically.
        </p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6 h-full">
      <section className="overflow-y-auto pr-2">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background/95 py-2">
          <div>
            <h3 className="text-sm font-semibold">
              Transcript · <span className="uppercase text-muted-foreground text-xs">{current.language}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {current.segments.length} segments · {formatDuration(current.durationMs)}
            </p>
          </div>
          <div className="flex gap-1">
            {current.srtUrl ? (
              <a href={current.srtUrl} download className="text-xs text-brand-700 hover:text-brand-800">
                Download .srt
              </a>
            ) : null}
            {current.vttUrl ? (
              <a href={current.vttUrl} download className="ml-2 text-xs text-brand-700 hover:text-brand-800">
                .vtt
              </a>
            ) : null}
          </div>
        </header>
        <ul className="divide-y divide-border">
          {current.segments.map((seg) => (
            <SegmentRow
              key={seg.id}
              segment={seg}
              dirty={dirtySegments.has(seg.id)}
              onEdit={(patch) => updateSegmentLocal(seg.id, patch)}
              onCommit={() => void flushSegment(seg)}
              onDelete={() => void deleteSegment(seg.id)}
            />
          ))}
        </ul>
      </section>

      <aside className="border-l border-border pl-6 space-y-4">
        <h3 className="text-sm font-semibold">Style</h3>
        <PreviewBubble style={style} />
        <StyleControls style={style} onChange={setStyle} />
        <Button size="sm" fullWidth loading={saving} onClick={saveStyle}>
          {captionId ? 'Save caption style' : 'Enable captions'}
        </Button>
      </aside>
    </div>
  );
}

function SegmentRow({
  segment,
  dirty,
  onEdit,
  onCommit,
  onDelete,
}: {
  segment: TranscriptSegment;
  dirty: boolean;
  onEdit: (patch: Partial<TranscriptSegment>) => void;
  onCommit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="py-2 flex gap-3 items-start">
      <div className="w-24 shrink-0 space-y-1">
        <TimeInput value={segment.startMs} onChange={(v) => onEdit({ startMs: v })} onBlur={onCommit} />
        <TimeInput value={segment.endMs} onChange={(v) => onEdit({ endMs: v })} onBlur={onCommit} />
      </div>
      <textarea
        value={segment.text}
        onChange={(e) => onEdit({ text: e.target.value })}
        onBlur={onCommit}
        rows={2}
        className={`flex-1 rounded-md border bg-surface-raised p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${
          dirty ? 'border-brand-300' : 'border-border'
        }`}
      />
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-danger"
        aria-label="Delete segment"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function TimeInput({
  value,
  onChange,
  onBlur,
}: {
  value: number;
  onChange: (ms: number) => void;
  onBlur: () => void;
}) {
  const [text, setText] = useState(formatTime(value));
  useEffect(() => setText(formatTime(value)), [value]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const ms = parseTime(text);
        if (ms !== null) onChange(ms);
        onBlur();
      }}
      className="w-full font-mono text-xs h-7 rounded border border-border bg-surface px-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
      inputMode="numeric"
    />
  );
}

function StyleControls({
  style,
  onChange,
}: {
  style: CaptionStyle;
  onChange: (s: CaptionStyle) => void;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-3 text-sm">
        <label className="block">
          <span className="text-xs text-muted-foreground">Font family</span>
          <select
            value={style.fontFamily ?? 'Inter'}
            onChange={(e) => onChange({ ...style, fontFamily: e.target.value })}
            className="mt-1 h-8 w-full rounded border border-border bg-surface px-2 text-xs"
          >
            {['Inter', 'Montserrat', 'Poppins', 'Roboto Mono', 'Playfair Display'].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Font size ({style.fontSize ?? 44})</span>
          <input
            type="range"
            min={24}
            max={96}
            value={style.fontSize ?? 44}
            onChange={(e) => onChange({ ...style, fontSize: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-muted-foreground">Color</span>
            <input
              type="color"
              value={style.color ?? '#ffffff'}
              onChange={(e) => onChange({ ...style, color: e.target.value })}
              className="mt-1 h-8 w-full rounded border border-border bg-surface"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-muted-foreground">Outline</span>
            <input
              type="color"
              value={style.outline?.color ?? '#000000'}
              onChange={(e) =>
                onChange({ ...style, outline: { color: e.target.value, width: style.outline?.width ?? 2 } })
              }
              className="mt-1 h-8 w-full rounded border border-border bg-surface"
            />
          </label>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Position</span>
          <div className="mt-1 flex gap-1">
            {(['top', 'middle', 'bottom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ ...style, position: p })}
                className={`flex-1 h-8 text-xs rounded border ${
                  style.position === p ? 'border-brand-400 bg-brand-100 text-brand-800' : 'border-border bg-surface hover:bg-surface-muted'
                } capitalize`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Animation</span>
          <select
            value={style.animation ?? 'word-by-word'}
            onChange={(e) => onChange({ ...style, animation: e.target.value as CaptionStyle['animation'] })}
            className="mt-1 h-8 w-full rounded border border-border bg-surface px-2 text-xs"
          >
            <option value="none">None</option>
            <option value="word-by-word">Word by word</option>
            <option value="fade-in">Fade in</option>
            <option value="pop">Pop</option>
            <option value="kinetic">Kinetic</option>
          </select>
        </div>
        <div className="flex gap-1 text-muted-foreground" role="group" aria-label="Align">
          <AlignLeft className="h-4 w-4" />
          <AlignCenter className="h-4 w-4" />
          <AlignRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewBubble({ style }: { style: CaptionStyle }) {
  return (
    <div className="rounded-md border border-border bg-black h-24 grid place-items-end p-3">
      <span
        style={{
          fontFamily: style.fontFamily,
          fontSize: Math.max(14, (style.fontSize ?? 44) * 0.35),
          color: style.color,
          background: style.background ?? undefined,
          padding: '2px 6px',
          borderRadius: 4,
          textShadow: style.outline
            ? `-1px -1px 0 ${style.outline.color}, 1px -1px 0 ${style.outline.color}, -1px 1px 0 ${style.outline.color}, 1px 1px 0 ${style.outline.color}`
            : undefined,
        }}
      >
        Sample caption preview
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const rem = total % 1000;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${rem.toString().padStart(3, '0')}`;
}

function parseTime(input: string): number | null {
  const match = input.trim().match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const [, mm, ss, ms] = match;
  const minutes = Number(mm);
  const seconds = Number(ss);
  const millis = ms ? Number(ms.padEnd(3, '0')) : 0;
  return minutes * 60_000 + seconds * 1000 + millis;
}
