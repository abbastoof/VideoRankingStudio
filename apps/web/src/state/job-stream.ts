'use client';

/**
 * WebSocket connection to /v1/ws/projects/:id.
 *
 * Handles reconnection with exponential backoff and pipes progress events
 * into the editor store's `activeJobs` map so the UI can render them.
 */

import { useEditorStore } from './editor-store';

interface ProgressEvent {
  jobId: string;
  status: string;
  progress: number;
  message?: string;
  resultJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface JobStream {
  close(): void;
}

export function connectJobStream(projectId: string, onEvent?: (e: ProgressEvent) => void): JobStream {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Track cleanup timers scheduled after terminal job states so we can
  // cancel them if the caller closes the stream first. Without this the
  // callbacks kept running against a torn-down editor store.
  const cleanupTimers = new Set<ReturnType<typeof setTimeout>>();

  const wsBase = API_URL.replace(/^http/, 'ws');

  function open() {
    if (closed) return;
    socket = new WebSocket(`${wsBase}/v1/ws/projects/${projectId}`);
    socket.onopen = () => {
      attempt = 0;
    };
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as ProgressEvent | { type: string };
        if ('type' in data && data.type === 'hello') return;
        const evt = data as ProgressEvent;
        const store = useEditorStore.getState();
        if (evt.status === 'SUCCEEDED' || evt.status === 'FAILED' || evt.status === 'CANCELED') {
          // Keep terminal state visible briefly, then clean up.
          store.setJob(evt.jobId, {
            kind: store.activeJobs[evt.jobId]?.kind ?? 'unknown',
            progress: 1,
            status: evt.status,
            errorMessage: evt.errorMessage ?? undefined,
          });
          const t = setTimeout(() => {
            cleanupTimers.delete(t);
            useEditorStore.getState().clearJob(evt.jobId);
          }, 6_000);
          cleanupTimers.add(t);
        } else {
          store.setJob(evt.jobId, {
            kind: store.activeJobs[evt.jobId]?.kind ?? 'unknown',
            progress: evt.progress,
            status: evt.status,
            message: evt.message,
          });
        }
        onEvent?.(evt);
      } catch {
        // ignore parse errors
      }
    };
    socket.onclose = () => {
      if (closed) return;
      attempt = Math.min(attempt + 1, 6);
      // Full jitter: pick a random point in [0, exp-cap]. Without jitter, a
      // server restart pushes every connected client into synchronized
      // reconnect waves — a straightforward thundering-herd DoS on ourselves.
      const cap = Math.min(30_000, 1000 * 2 ** attempt);
      const backoff = Math.floor(Math.random() * cap) + 250;
      reconnectTimer = setTimeout(open, backoff);
    };
    socket.onerror = () => {
      socket?.close();
    };
  }

  open();

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const t of cleanupTimers) clearTimeout(t);
      cleanupTimers.clear();
      socket?.close();
    },
  };
}
