import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leftIcon, rightIcon, invalid, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 h-10 px-3 rounded-md border bg-surface-raised text-foreground transition-colors',
        'border-border focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-300',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger/30',
        className,
      )}
    >
      {leftIcon ? <span className="text-muted-foreground" aria-hidden>{leftIcon}</span> : null}
      <input
        ref={ref}
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
        aria-invalid={invalid || undefined}
        {...props}
      />
      {rightIcon ? <span className="text-muted-foreground" aria-hidden>{rightIcon}</span> : null}
    </div>
  );
});
