'use client';

import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';

/**
 * Accessible modal dialog.
 *
 * - Focus trap while open (Tab / Shift+Tab loop through focusable descendants).
 * - Restores focus to the element that opened the dialog.
 * - Closes on Escape and on backdrop click.
 * - `role="dialog"` + `aria-modal` + labelled by `DialogTitle`.
 * - Body scroll locked while open.
 */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /**
   * If false, clicks on the backdrop are ignored. Escape still closes.
   */
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
  closeOnBackdrop = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      focusFirst(containerRef.current);
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        trapFocus(containerRef.current, e);
      }
    }
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      const ret = returnFocusRef.current;
      if (ret instanceof HTMLElement) ret.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative w-full rounded-lg border border-border bg-surface-raised shadow-floating outline-none animate-slide-up',
          size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children ? <div className="px-5 pb-5">{children}</div> : null}
      </div>
    </div>
  );
}

function focusFirst(container: HTMLElement | null) {
  if (!container) return;
  const target =
    container.querySelector<HTMLElement>('[autofocus]') ??
    getFocusable(container)[0] ??
    container;
  target.focus();
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('inert') && el.offsetParent !== null,
  );
}

function trapFocus(container: HTMLElement | null, e: KeyboardEvent) {
  if (!container) return;
  const focusable = getFocusable(container);
  if (focusable.length === 0) {
    e.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const current = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (current === first || !container.contains(current)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (current === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// ─── Confirm helper ────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      }),
    [],
  );

  function close(value: boolean) {
    if (!state) return;
    state.resolve(value);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        description={state?.description}
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => close(false)}>
            {state?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={state?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => close(true)}
            autoFocus
          >
            {state?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Access the confirm() function. Falls back to a native `window.confirm`
 * when no `ConfirmProvider` is mounted so smoke calls still work.
 */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (ctx) return ctx.confirm;
  return (opts) =>
    Promise.resolve(
      typeof window !== 'undefined'
        ? window.confirm(`${opts.title}${opts.description ? `\n\n${opts.description}` : ''}`)
        : false,
    );
}
