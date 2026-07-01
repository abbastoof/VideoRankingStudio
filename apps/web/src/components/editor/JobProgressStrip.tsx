'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { useEditorStore } from '@/state/editor-store';

/**
 * Slim strip beneath the toolbar showing all in-flight generation jobs.
 * Terminal states (succeeded / failed) linger briefly then self-dismiss
 * via `job-stream.ts`.
 */
export function JobProgressStrip() {
  const jobs = useEditorStore((s) => s.activeJobs);
  const entries = Object.entries(jobs);
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface-muted/60 px-4 py-2 flex flex-wrap gap-2">
      {entries.map(([id, job]) => (
        <div
          key={id}
          className="flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs"
        >
          <StatusIcon status={job.status} />
          <span className="font-medium capitalize">{prettyKind(job.kind)}</span>
          {job.status === 'RUNNING' ? (
            <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
          ) : null}
          {job.message ? (
            <span className="text-muted-foreground max-w-[220px] truncate">{job.message}</span>
          ) : null}
          {job.status === 'FAILED' && job.errorMessage ? (
            <span className="text-danger max-w-[240px] truncate">{job.errorMessage}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'SUCCEEDED') return <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />;
  if (status === 'FAILED' || status === 'CANCELED')
    return <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" aria-hidden />;
}

function prettyKind(kind: string): string {
  return kind
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
