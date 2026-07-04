'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Color of the filled portion of the track. Defaults to the brand color. */
  fillColor?: string;
}

/**
 * Styled native range input. The filled track is painted with a gradient
 * driven by the current value, so it works without JS-measured layout.
 * Thumb/track styling lives in globals.css (`.vrs-slider`).
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { value, onValueChange, min = 0, max = 100, step = 1, fillColor, className, style, ...props },
  ref,
) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const fill = fillColor ?? 'rgb(var(--color-brand-500))';
  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn('vrs-slider w-full', className)}
      style={{
        ...style,
        background: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, rgb(var(--color-border)) ${pct}%, rgb(var(--color-border)) 100%)`,
      }}
      {...props}
    />
  );
});
