import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 5, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full min-h-[6rem] px-3 py-2 rounded-md border bg-surface-raised text-foreground transition-colors resize-y',
        'border-border focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300',
        'placeholder:text-muted-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-danger focus:border-danger focus:ring-danger/30',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
