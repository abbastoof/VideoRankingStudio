'use client';

import { Info, Percent } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { RankingDetail, RankingMetaPatch, RankingTitleStyle } from '@vrs/sdk';
import { Card, CardContent, ColorPicker, Input, Select, Switch } from '@vrs/ui';

import { fontCssFor } from '@/lib/fonts';

import { DEFAULT_TITLE_STYLE } from './ranking-layout';
import { TitleStrokeRow, TitleStyleToolbar } from './TitleStyleToolbar';

interface CardProps {
  ranking: RankingDetail;
  patchMeta: (patch: RankingMetaPatch) => void;
}

/** "Video Ranking Title" card: toolbar, big input, stroke row. */
export function TitleCard({ ranking, patchMeta }: CardProps) {
  const idBase = useId();
  const style = { ...DEFAULT_TITLE_STYLE, ...(ranking.titleStyle ?? {}) };

  function onStyle(next: RankingTitleStyle) {
    patchMeta({ titleStyle: next });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Video Ranking Title</h2>
        </div>
        <TitleStyleToolbar value={ranking.titleStyle} onChange={onStyle} idBase={idBase} />
        <input
          type="text"
          value={ranking.headerText ?? ''}
          onChange={(e) => patchMeta({ headerText: e.target.value || null })}
          placeholder="Enter ranking title..."
          aria-label="Ranking title"
          maxLength={200}
          className="w-full rounded-lg bg-surface-muted px-4 py-4 text-2xl font-bold tracking-tight outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-300"
          style={{
            fontFamily: fontCssFor(style.fontFamily),
            fontStyle: style.italic ? 'italic' : undefined,
          }}
        />
        <TitleStrokeRow value={ranking.titleStyle} onChange={onStyle} idBase={idBase} />
      </CardContent>
    </Card>
  );
}

/** "General Setting" card: video height %, background color, captions. */
export function GeneralSettingsCard({ ranking, patchMeta }: CardProps) {
  const heightId = useId();
  const captionId = useId();
  // Draft so the user can type freely ("8" on the way to "80" must not snap
  // to the clamp); commit on blur/Enter, live-update only when in range.
  const [heightDraft, setHeightDraft] = useState(String(ranking.videoHeightPct));
  useEffect(() => setHeightDraft(String(ranking.videoHeightPct)), [ranking.videoHeightPct]);

  function commitHeight() {
    const v = Number(heightDraft);
    if (Number.isFinite(v) && heightDraft.trim() !== '') {
      patchMeta({ videoHeightPct: Math.min(100, Math.max(10, Math.round(v))) });
    } else {
      setHeightDraft(String(ranking.videoHeightPct));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">General Setting</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={heightId} className="text-xs font-medium text-muted-foreground">
              Video height
            </label>
            <Input
              id={heightId}
              type="number"
              min={10}
              max={100}
              value={heightDraft}
              onChange={(e) => {
                setHeightDraft(e.target.value);
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 10 && v <= 100) {
                  patchMeta({ videoHeightPct: Math.round(v) });
                }
              }}
              onBlur={commitHeight}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitHeight();
                }
              }}
              rightIcon={<Percent className="h-4 w-4" />}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Background</span>
            <ColorPicker
              aria-label="Background color"
              value={ranking.backgroundColor}
              onChange={(hex) => patchMeta({ backgroundColor: hex })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch
            id={captionId}
            checked={ranking.captionsEnabled}
            onCheckedChange={(v) => patchMeta({ captionsEnabled: v })}
            aria-labelledby={`${captionId}-label`}
          />
          <label id={`${captionId}-label`} htmlFor={captionId} className="text-sm">
            Enable Caption
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/** "Playback Order" card: custom order switch + score-order controls. */
export function PlaybackOrderCard({ ranking, patchMeta }: CardProps) {
  const switchId = useId();
  const custom = ranking.orderMode === 'custom';
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">Playback Order</h2>
            <span
              title="The order videos play in the final ranking. Custom lets you arrange cards by hand; otherwise the score decides."
              className="text-muted-foreground"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">
                The order videos play in the final ranking. Custom lets you arrange cards by hand;
                otherwise the score decides.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <label htmlFor={switchId} className="text-sm text-muted-foreground">
              Custom Playback Order
            </label>
            <Switch
              id={switchId}
              checked={custom}
              onCheckedChange={(v) => patchMeta({ orderMode: v ? 'custom' : 'score' })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Reveal</span>
            <Select
              aria-label="Reveal order"
              value={ranking.reveal}
              onChange={(e) =>
                patchMeta({ reveal: e.target.value as 'countdown' | 'topfirst' })
              }
            >
              <option value="countdown">Countdown to #1</option>
              <option value="topfirst">Top item first</option>
            </Select>
          </div>
          {!custom ? (
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Score order</span>
              <Select
                aria-label="Score order"
                value={ranking.order}
                onChange={(e) => patchMeta({ order: e.target.value as 'asc' | 'desc' })}
              >
                <option value="desc">Highest score first</option>
                <option value="asc">Lowest score first</option>
              </Select>
            </div>
          ) : (
            <p className="self-end pb-2 text-xs text-muted-foreground">
              Drag or use the arrows on each card — #1 plays according to the reveal.
            </p>
          )}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Transition</span>
            <Select
              aria-label="Transition between videos"
              value={ranking.transition}
              onChange={(e) => patchMeta({ transition: e.target.value as 'none' | 'fade' })}
            >
              <option value="fade">Crossfade</option>
              <option value="none">Hard cut</option>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
