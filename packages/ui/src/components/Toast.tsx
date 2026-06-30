import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '../lib/cn';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />,
  info: <Info className="h-5 w-5 text-info" aria-hidden />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />,
  danger: <XCircle className="h-5 w-5 text-danger" aria-hidden />,
};

export interface ToastProps {
  tone?: ToastTone;
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}

export function Toast({ tone = 'info', title, description, onClose, className }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex gap-3 p-4 rounded-md border border-border bg-surface-raised shadow-floating',
        className,
      )}
    >
      <span className="shrink-0 mt-0.5">{ICONS[tone]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
