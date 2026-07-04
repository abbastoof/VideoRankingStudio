import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  selectSize?: 'sm' | 'md';
}

/**
 * Styled native select. Native `<select>` keeps full keyboard + screen-reader
 * behavior for free; only the closed control is themed.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, selectSize = 'md', children, ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none rounded-md border bg-surface-raised pr-8 text-foreground transition-colors',
          'border-border focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300',
          'disabled:cursor-not-allowed disabled:opacity-50',
          selectSize === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
          invalid && 'border-danger focus:border-danger focus:ring-danger/30',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground',
          selectSize === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
        )}
      />
    </div>
  );
});
