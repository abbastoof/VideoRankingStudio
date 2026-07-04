'use client';

import { forwardRef, useEffect, useState } from 'react';

import { cn } from '../lib/cn';

export interface ColorPickerProps {
  /** Current color as `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  /** Show the hex text field next to the swatch (Viblo's `#2B2A2A` pattern). */
  showHexInput?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  id?: string;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(raw: string): string | null {
  let v = raw.trim();
  if (!v.startsWith('#')) v = `#${v}`;
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v.toLowerCase();
}

/**
 * Color swatch backed by the native color input, with an optional hex text
 * field. Free-typed hex is applied on blur/Enter only when valid; otherwise
 * the field snaps back to the current value.
 */
export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(function ColorPicker(
  { value, onChange, showHexInput = true, disabled, className, id, 'aria-label': ariaLabel },
  ref,
) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commitDraft() {
    const normalized = normalizeHex(draft);
    if (normalized && normalized !== value) {
      onChange(normalized);
    } else {
      setDraft(value);
    }
  }

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-md border border-border bg-surface-raised px-2',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-300 transition-colors',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <span className="relative inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border-strong shadow-sm">
        <input
          ref={ref}
          id={id}
          type="color"
          value={normalizeHex(value) ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel ?? 'Pick color'}
          className="absolute -inset-1 h-8 w-8 cursor-pointer border-0 p-0"
        />
      </span>
      {showHexInput ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
          disabled={disabled}
          spellCheck={false}
          aria-label={ariaLabel ? `${ariaLabel} (hex)` : 'Color hex value'}
          className="w-20 bg-transparent font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="#000000"
        />
      ) : null}
    </div>
  );
});
