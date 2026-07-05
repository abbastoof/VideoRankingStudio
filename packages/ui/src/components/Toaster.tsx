'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Toast, type ToastTone } from './Toast';

/**
 * App-wide toast queue.
 *
 *   const toast = useToast();
 *   toast({ tone: 'success', title: 'Export queued' });
 *
 * Renders into a portal (bottom-right, stacked, max 4 visible), auto-
 * dismisses after `durationMs` (default 5s, danger 8s), pauses the timer
 * while hovered.
 */

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Auto-dismiss delay. Defaults to 5000 (8000 for danger). */
  durationMs?: number;
}

type ToastFn = (opts: ToastOptions) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

interface QueuedToast extends ToastOptions {
  id: number;
}

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const nextId = useRef(1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>((opts) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...opts, id }]);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-label="Notifications"
              className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
            >
              {toasts.map((t) => (
                <TimedToast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function TimedToast({ toast, onDismiss }: { toast: QueuedToast; onDismiss: () => void }) {
  const duration = toast.durationMs ?? (toast.tone === 'danger' ? 8000 : 5000);
  const remaining = useRef(duration);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clear();
    startedAt.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
  }, [clear, onDismiss]);

  useEffect(() => {
    arm();
    return clear;
  }, [arm, clear]);

  return (
    <div
      className="pointer-events-auto animate-slide-up motion-reduce:animate-none"
      onMouseEnter={() => {
        remaining.current -= Date.now() - startedAt.current;
        clear();
      }}
      onMouseLeave={() => {
        remaining.current = Math.max(1000, remaining.current);
        arm();
      }}
    >
      <Toast
        tone={toast.tone}
        title={toast.title}
        description={toast.description}
        onClose={onDismiss}
      />
    </div>
  );
}
