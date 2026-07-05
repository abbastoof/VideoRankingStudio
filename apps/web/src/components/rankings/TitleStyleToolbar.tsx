'use client';

import { Bold, Italic } from 'lucide-react';

import type { RankingTitleStyle } from '@vrs/sdk';
import { cn, ColorPicker, Select, Slider } from '@vrs/ui';

import { TITLE_FONTS } from '@/lib/fonts';

import { DEFAULT_TITLE_STYLE, FONT_SIZE_OPTIONS } from './ranking-layout';

export interface TitleStyleToolbarProps {
  value: RankingTitleStyle | null;
  onChange: (next: RankingTitleStyle) => void;
  /** Base for generated control ids (accessibility labels). */
  idBase: string;
  className?: string;
}

/**
 * Viblo-style rich text controls: font family, size, bold/italic, text
 * color, and a background pill toggle. Stroke lives below the input in its
 * own row (see TitleStrokeRow).
 */
export function TitleStyleToolbar({ value, onChange, idBase, className }: TitleStyleToolbarProps) {
  const style = { ...DEFAULT_TITLE_STYLE, ...(value ?? {}) };
  const font = TITLE_FONTS.find((f) => f.family === style.fontFamily) ?? TITLE_FONTS[0]!;

  function patch(next: Partial<RankingTitleStyle>) {
    onChange({ ...style, ...next });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select
        aria-label="Title font"
        id={`${idBase}-font`}
        selectSize="sm"
        className="w-40"
        value={font.family}
        onChange={(e) => patch({ fontFamily: e.target.value })}
      >
        {TITLE_FONTS.map((f) => (
          <option key={f.family} value={f.family}>
            {f.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Title size"
        id={`${idBase}-size`}
        selectSize="sm"
        className="w-24"
        value={String(style.fontSize)}
        onChange={(e) => patch({ fontSize: Number(e.target.value) })}
      >
        {[...new Set([...FONT_SIZE_OPTIONS, style.fontSize])]
          .sort((a, b) => a - b)
          .map((s) => (
            <option key={s} value={String(s)}>
              {s}px
            </option>
          ))}
      </Select>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarToggle
        label="Bold"
        pressed={style.bold}
        disabled={!font.hasBold}
        onClick={() => patch({ bold: !style.bold })}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Italic"
        pressed={style.italic}
        onClick={() => patch({ italic: !style.italic })}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarToggle>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ColorPicker
        aria-label="Text color"
        value={style.color}
        onChange={(hex) => patch({ color: hex })}
        showHexInput={false}
        className="h-8 border-0 bg-transparent px-0"
      />
      <ToolbarToggle
        label="Text background"
        pressed={Boolean(style.background)}
        onClick={() => patch({ background: style.background ? null : '#000000' })}
      >
        <span
          className={cn(
            'grid h-3.5 w-3.5 place-items-center rounded-sm border text-[9px] font-bold leading-none',
            style.background ? 'border-transparent bg-foreground text-background' : 'border-current',
          )}
          aria-hidden
        >
          T
        </span>
      </ToolbarToggle>
      {style.background ? (
        <ColorPicker
          aria-label="Text background color"
          value={style.background}
          onChange={(hex) => patch({ background: hex })}
          showHexInput={false}
          className="h-8 border-0 bg-transparent px-0"
        />
      ) : null}
    </div>
  );
}

export function TitleStrokeRow({
  value,
  onChange,
  idBase,
}: {
  value: RankingTitleStyle | null;
  onChange: (next: RankingTitleStyle) => void;
  idBase: string;
}) {
  const style = { ...DEFAULT_TITLE_STYLE, ...(value ?? {}) };
  return (
    <div className="space-y-1.5">
      <label htmlFor={`${idBase}-stroke`} className="text-xs font-medium text-muted-foreground">
        Title Stroke
      </label>
      <div className="flex items-center gap-3">
        <ColorPicker
          aria-label="Stroke color"
          value={style.strokeColor}
          onChange={(hex) => onChange({ ...style, strokeColor: hex })}
          showHexInput={false}
          className="h-8 shrink-0 border-0 bg-transparent px-0"
        />
        <Slider
          id={`${idBase}-stroke`}
          aria-label="Stroke width"
          min={0}
          max={20}
          step={1}
          value={style.strokeWidth}
          onValueChange={(v) => onChange({ ...style, strokeWidth: v })}
          className="max-w-xs"
        />
        <span className="w-8 text-right font-mono text-xs text-muted-foreground">
          {style.strokeWidth}
        </span>
      </div>
    </div>
  );
}

function ToolbarToggle({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md border text-foreground transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        'disabled:pointer-events-none disabled:opacity-40',
        pressed
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-transparent hover:bg-surface-muted',
      )}
    >
      {children}
    </button>
  );
}
