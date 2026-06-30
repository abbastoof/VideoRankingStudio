import { Loader2 } from 'lucide-react';

import { cn } from '../lib/cn';

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <Loader2 className="animate-spin" style={{ width: size, height: size }} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
