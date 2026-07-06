'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp, Instagram, Mic2, Trash2, Youtube } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import type { RankingCandidateDetail, RankingCandidatePatch, RankingTitleStyle } from '@vrs/sdk';
import {
  Button,
  Card,
  CardContent,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ColorPicker,
  Dropzone,
  Select,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useConfirm,
} from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

import type { ImportState } from './useRankingBuilder';
import {
  candidateStyles,
  NUMBER_SIZE_OPTIONS,
  type EntranceAnimation,
  type NumberStyle,
} from './ranking-layout';
import { TitleStyleToolbar, TitleStrokeRow } from './TitleStyleToolbar';
import { TrimBar } from './TrimBar';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export interface CandidateCardProps {
  candidate: RankingCandidateDetail;
  index: number;
  count: number;
  importState: ImportState | undefined;
  voiceoverState: ImportState | undefined;
  /** Accent color of the ranking — the number's default color. */
  brandColor: string;
  onPatch: (patch: RankingCandidatePatch) => void;
  /** Debounced variant for continuous controls (style edits). */
  onPatchDebounced: (patch: RankingCandidatePatch) => void;
  onImportUrl: (url: string) => void;
  onUploadFile: (file: File) => void;
  onGenerateVoiceover: (input: { voiceId: string; scriptText: string }) => void;
  onRemoveVoiceover: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
}

/**
 * One "Video Rank N" card. Before a video is attached it offers link import
 * and file upload; after attach it flips to preview + trim + title editing.
 */
export function CandidateCard({
  candidate,
  index,
  count,
  importState,
  voiceoverState,
  brandColor,
  onPatch,
  onPatchDebounced,
  onImportUrl,
  onUploadFile,
  onGenerateVoiceover,
  onRemoveVoiceover,
  onMove,
  onRemove,
}: CandidateCardProps) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(true);
  const hasVideo = Boolean(candidate.assetId);
  const importing = importState?.status === 'importing';

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove Video Rank ${index + 1}?`,
      description: 'The video and its settings will be removed from this ranking.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) onRemove();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="py-0.5 text-sm font-semibold">
              Video Rank {index + 1}
            </CollapsibleTrigger>
            <div className="flex items-center gap-0.5">
              <IconButton
                label="Move up"
                disabled={index === 0}
                onClick={() => onMove('up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Move down"
                disabled={index === count - 1}
                onClick={() => onMove('down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Remove video" onClick={() => void handleRemove()} danger>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>

          <CollapsibleContent className="pt-4">
            {hasVideo ? (
              <AttachedBody
                candidate={candidate}
                brandColor={brandColor}
                voiceoverState={voiceoverState}
                onPatch={onPatch}
                onPatchDebounced={onPatchDebounced}
                onGenerateVoiceover={onGenerateVoiceover}
                onRemoveVoiceover={onRemoveVoiceover}
              />
            ) : (
              <EmptyBody
                importing={importing}
                importError={importState?.status === 'error' ? importState.error : undefined}
                onImportUrl={onImportUrl}
                onUploadFile={onUploadFile}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/** Link input with platform icons + arrow submit, OR divider, dropzone. */
function EmptyBody({
  importing,
  importError,
  onImportUrl,
  onUploadFile,
}: {
  importing: boolean;
  importError: string | undefined;
  onImportUrl: (url: string) => void;
  onUploadFile: (file: File) => void;
}) {
  const [url, setUrl] = useState('');
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const inputId = useId();
  const canSubmit = /^https:\/\/\S+/.test(url.trim()) && !importing;

  function submit() {
    if (canSubmit) onImportUrl(url.trim());
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          Video Link
        </label>
        <div
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-md border border-border bg-surface-raised pl-3 pr-1.5 transition-colors',
            'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-300',
          )}
        >
          <span className="flex items-center gap-1.5 text-muted-foreground" aria-hidden>
            <Youtube className="h-4 w-4 text-[#FF0000]" />
            <TikTokMark className="h-3.5 w-3.5" />
            <Instagram className="h-4 w-4 text-[#E1306C]" />
          </span>
          <input
            id={inputId}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            disabled={importing}
            placeholder="TikTok, Instagram, or YouTube video link"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="button"
            aria-label="Import video from link"
            disabled={!canSubmit}
            onClick={submit}
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-500 text-brand-foreground transition-colors',
              'hover:bg-brand-400 disabled:opacity-40 disabled:hover:bg-brand-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            )}
          >
            {importing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {importing ? (
          <p className="text-xs text-muted-foreground" role="status">
            Importing video — this can take a minute for longer clips…
          </p>
        ) : null}
        {importError ? (
          <p className="text-xs text-danger" role="alert">
            {importError}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">Upload Video</span>
        <Dropzone
          accept="video/mp4,video/quicktime,video/webm"
          maxSizeBytes={MAX_UPLOAD_BYTES}
          disabled={importing}
          label="Choose a clip or drag and drop it here"
          hint="MP4 format, up to 500MB"
          browseLabel="Browse file"
          onFiles={(files) => {
            setRejectMsg(null);
            if (files[0]) onUploadFile(files[0]);
          }}
          onReject={(reason) => setRejectMsg(reason)}
        />
        {rejectMsg ? (
          <p className="text-xs text-danger" role="alert">
            {rejectMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** After attach: inline player, trim + volume, then the per-video tabs. */
function AttachedBody({
  candidate,
  brandColor,
  voiceoverState,
  onPatch,
  onPatchDebounced,
  onGenerateVoiceover,
  onRemoveVoiceover,
}: {
  candidate: RankingCandidateDetail;
  brandColor: string;
  voiceoverState: ImportState | undefined;
  onPatch: (patch: RankingCandidatePatch) => void;
  onPatchDebounced: (patch: RankingCandidatePatch) => void;
  onGenerateVoiceover: (input: { voiceId: string; scriptText: string }) => void;
  onRemoveVoiceover: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processing = candidate.assetStatus !== 'READY' && candidate.assetStatus !== 'UPLOADED';
  const durationMs = candidate.assetDurationMs ?? 0;
  const [tab, setTab] = useState('title');

  return (
    <div className="space-y-4">
      {processing ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-6 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Processing video — the preview appears when it&apos;s ready.
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-sm overflow-hidden rounded-lg bg-black">
            {candidate.assetUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- source clips have no caption tracks
              <video
                ref={videoRef}
                src={candidate.assetUrl}
                poster={candidate.thumbnailUrl ?? undefined}
                controls
                preload="metadata"
                playsInline
                className="max-h-80 w-full"
              />
            ) : null}
          </div>
          {durationMs > 0 ? (
            <TrimBar
              durationMs={durationMs}
              trimStartMs={candidate.trimStartMs}
              trimEndMs={candidate.trimEndMs}
              volume={candidate.volume}
              onTrimChange={(startMs, endMs) =>
                onPatch({ trimStartMs: startMs, trimEndMs: endMs })
              }
              onVolumeChange={(v) => onPatch({ volume: v })}
            />
          ) : null}
        </>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="title">Video Title</TabsTrigger>
          <TabsTrigger value="number">Number Appearance</TabsTrigger>
          <TabsTrigger value="voiceover">Voiceover</TabsTrigger>
          <TabsTrigger value="animation">Animation &amp; Transition</TabsTrigger>
        </TabsList>
        <TabsContent value="title" className="pt-4">
          <VideoTitleTab
            candidate={candidate}
            onPatch={onPatch}
            onPatchDebounced={onPatchDebounced}
          />
        </TabsContent>
        <TabsContent value="number" className="pt-4">
          <NumberAppearanceTab
            candidate={candidate}
            brandColor={brandColor}
            onPatchDebounced={onPatchDebounced}
          />
        </TabsContent>
        <TabsContent value="voiceover" className="pt-4">
          <VoiceoverTab
            candidate={candidate}
            state={voiceoverState}
            onGenerate={onGenerateVoiceover}
            onRemove={onRemoveVoiceover}
          />
        </TabsContent>
        <TabsContent value="animation" className="pt-4">
          <AnimationTab candidate={candidate} onPatchDebounced={onPatchDebounced} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** "Video Title" tab: text + the same style controls as the ranking title. */
function VideoTitleTab({
  candidate,
  onPatch,
  onPatchDebounced,
}: {
  candidate: RankingCandidateDetail;
  onPatch: (patch: RankingCandidatePatch) => void;
  onPatchDebounced: (patch: RankingCandidatePatch) => void;
}) {
  const titleId = useId();
  const { titleStyle } = candidateStyles(candidate.metadataJson);

  function patchStyle(next: RankingTitleStyle) {
    onPatchDebounced({
      metadataJson: { ...candidate.metadataJson, titleStyle: next },
    });
  }

  return (
    <div className="space-y-3">
      <TitleStyleToolbar value={titleStyle} onChange={patchStyle} idBase={titleId} />
      <input
        id={titleId}
        type="text"
        defaultValue={candidate.title}
        key={candidate.title /* refresh after auto-fill */}
        maxLength={200}
        placeholder="Enter video title..."
        aria-label="Video title"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== candidate.title) onPatch({ title: v });
        }}
        className="w-full rounded-lg bg-surface-muted px-4 py-3 text-lg font-semibold outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-300"
      />
      <TitleStrokeRow value={titleStyle} onChange={patchStyle} idBase={`${titleId}-stroke`} />
    </div>
  );
}

/** "Voiceover" tab: pick a voice, narrate the slot, preview the audio. */
function VoiceoverTab({
  candidate,
  state,
  onGenerate,
  onRemove,
}: {
  candidate: RankingCandidateDetail;
  state: ImportState | undefined;
  onGenerate: (input: { voiceId: string; scriptText: string }) => void;
  onRemove: () => void;
}) {
  const idBase = useId();
  const voicesQuery = useQuery({
    queryKey: ['voices'],
    queryFn: () => clientSdk().listVoices(),
    staleTime: 5 * 60_000,
  });
  const voices = voicesQuery.data?.items ?? [];
  const readyVoices = voices.filter((v) => v.status === 'READY');

  const [voiceId, setVoiceId] = useState<string>(candidate.voiceoverVoiceId ?? '');
  const [script, setScript] = useState<string>(candidate.voiceoverScript ?? candidate.title);
  const generating = state?.status === 'importing';
  const selectedVoice = voiceId || readyVoices[0]?.id || '';
  const hasVoiceover = Boolean(candidate.voiceoverUrl);

  return (
    <div className="space-y-3">
      {hasVoiceover ? (
        <div className="space-y-2 rounded-lg bg-surface-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Mic2 className="h-3.5 w-3.5" aria-hidden />
              Narration for this video
              {candidate.voiceoverDurationMs ? (
                <span className="font-mono">
                  · {(candidate.voiceoverDurationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
            </span>
            <Button variant="ghost" size="xs" onClick={onRemove}>
              Remove
            </Button>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated narration; script shown below */}
          <audio controls preload="metadata" src={candidate.voiceoverUrl!} className="w-full" />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-voice`} className="text-xs font-medium text-muted-foreground">
            Voice
          </label>
          <Select
            id={`${idBase}-voice`}
            aria-label="Voice"
            value={selectedVoice}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={voicesQuery.isLoading || readyVoices.length === 0}
          >
            {readyVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.provider === 'INTERNAL' ? ' — free' : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-script`} className="text-xs font-medium text-muted-foreground">
            Script
          </label>
          <Textarea
            id={`${idBase}-script`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What should the narrator say during this video?"
          />
        </div>
      </div>

      {state?.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Narration is mixed over the video for this slot in the final export.
        </p>
        <Button
          size="sm"
          loading={generating}
          disabled={!selectedVoice || !script.trim()}
          leftIcon={<Mic2 className="h-4 w-4" />}
          onClick={() => onGenerate({ voiceId: selectedVoice, scriptText: script.trim() })}
        >
          {hasVoiceover ? 'Regenerate' : 'Generate Voiceover'}
        </Button>
      </div>
    </div>
  );
}

/** "Animation & Transition" tab: overlay entrance per video. */
function AnimationTab({
  candidate,
  onPatchDebounced,
}: {
  candidate: RankingCandidateDetail;
  onPatchDebounced: (patch: RankingCandidatePatch) => void;
}) {
  const idBase = useId();
  const { animation } = candidateStyles(candidate.metadataJson);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-entrance`} className="text-xs font-medium text-muted-foreground">
          Title &amp; number entrance
        </label>
        <Select
          id={`${idBase}-entrance`}
          aria-label="Overlay entrance animation"
          value={animation ?? 'default'}
          onChange={(e) => {
            const v = e.target.value;
            onPatchDebounced({
              metadataJson: {
                ...candidate.metadataJson,
                animation: v === 'default' ? undefined : (v as EntranceAnimation),
              },
            });
          }}
        >
          <option value="default">Default (title fades, number pops)</option>
          <option value="fade-in">Fade in</option>
          <option value="pop">Pop</option>
          <option value="none">None</option>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        The transition between videos (crossfade or hard cut) is a ranking-wide setting — find it
        on the Playback Order card.
      </p>
    </div>
  );
}

/** "Number Appearance" tab: rank badge visibility, color, size, position. */
function NumberAppearanceTab({
  candidate,
  brandColor,
  onPatchDebounced,
}: {
  candidate: RankingCandidateDetail;
  brandColor: string;
  onPatchDebounced: (patch: RankingCandidatePatch) => void;
}) {
  const idBase = useId();
  const { numberStyle } = candidateStyles(candidate.metadataJson);

  function patchNumber(next: Partial<NumberStyle>) {
    onPatchDebounced({
      metadataJson: {
        ...candidate.metadataJson,
        numberStyle: { ...numberStyle, ...next },
      },
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <label htmlFor={`${idBase}-visible`} className="text-sm font-medium">
          Show rank number
        </label>
        <Switch
          id={`${idBase}-visible`}
          checked={numberStyle.visible}
          onCheckedChange={(v) => patchNumber({ visible: v })}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-color`} className="text-xs font-medium text-muted-foreground">
          Number color
        </label>
        <ColorPicker
          id={`${idBase}-color`}
          aria-label="Number color"
          value={numberStyle.color ?? brandColor}
          onChange={(hex) => patchNumber({ color: hex })}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-size`} className="text-xs font-medium text-muted-foreground">
          Number size
        </label>
        <Select
          id={`${idBase}-size`}
          aria-label="Number size"
          value={String(numberStyle.fontSize)}
          onChange={(e) => patchNumber({ fontSize: Number(e.target.value) })}
        >
          {NUMBER_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={String(o.value)}>
              {o.label}
            </option>
          ))}
          {NUMBER_SIZE_OPTIONS.every((o) => o.value !== numberStyle.fontSize) ? (
            <option value={String(numberStyle.fontSize)}>{numberStyle.fontSize}px</option>
          ) : null}
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`${idBase}-pos`} className="text-xs font-medium text-muted-foreground">
          Position
        </label>
        <Select
          id={`${idBase}-pos`}
          aria-label="Number position"
          value={numberStyle.position}
          onChange={(e) =>
            patchNumber({ position: e.target.value as NumberStyle['position'] })
          }
        >
          <option value="left">Top left</option>
          <option value="center">Top center</option>
          <option value="right">Top right</option>
        </Select>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-surface-muted hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        'disabled:pointer-events-none disabled:opacity-40',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

/** Minimal TikTok glyph (lucide has no brand mark for it). */
function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.9 2.9 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.1 20.14a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.14-.14z" />
    </svg>
  );
}
