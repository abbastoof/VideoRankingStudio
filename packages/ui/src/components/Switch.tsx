'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

/**
 * Accessible toggle switch (`role="switch"`), controlled only.
 * Pair with an external `<label>` via `id`/`htmlFor` or `aria-label`.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, size = 'md', className, disabled, ...props },
  ref,
) {
  const dims =
    size === 'sm'
      ? { track: 'h-4 w-7', thumb: 'h-3 w-3', on: 'translate-x-3' }
      : { track: 'h-5 w-9', thumb: 'h-4 w-4', on: 'translate-x-4' };
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'transition-colors duration-200 motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        dims.track,
        checked ? 'bg-brand-500' : 'bg-border-strong',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none block translate-x-0.5 rounded-full bg-white shadow-sm ring-0',
          'transition-transform duration-200 motion-reduce:transition-none',
          dims.thumb,
          checked && dims.on,
        )}
      />
    </button>
  );
});
