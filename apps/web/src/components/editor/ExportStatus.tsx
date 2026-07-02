'use client';

import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Card, CardContent } from '@vrs/ui';

import { PublishDialog } from '@/components/editor/PublishDialog';
import { clientSdk } from '@/lib/client-sdk';
import { connectJobStream } from '@/state/job-stream';

interface ExportRecord {
  id: string;
  projectId: string;
  format: string;
  resolutionW: number;
  resolutionH: number;
  fps: number;
  status: string;
  progress: number;
  watermark: boolean;
  downloadUrl: string | null;
  errorMessage: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export function ExportStatus({ projectId, exportId }: { projectId: string; exportId: string }) {
  const [record, setRecord] = useState<ExportRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  // Keep the latest record in a ref so the polling interval — which only
  // runs its `useEffect` on projectId/exportId — can read the current
  // status without recreating itself on every state change. The previous
  // version closed over `record: null` and polled forever after completion.
  const recordRef = useRef<ExportRecord | null>(null);
  recordRef.current = record;

  async function refresh() {
    try {
      const data = await clientSdk().getExport(exportId);
      setRecord(data as ExportRecord);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load export');
    }
  }

  useEffect(() => {
    void refresh();
    const stream = connectJobStream(projectId, () => {
      // Any progress event on the project prompts a refresh — cheap and always
      // in sync with server state.
      void refresh();
    });
    const poll = setInterval(() => {
      const r = recordRef.current;
      if (r && (r.status === 'COMPLETED' || r.status === 'FAILED')) return;
      void refresh();
    }, 4000);
    return () => {
      stream.close();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, exportId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!record) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const done = record.status === 'COMPLETED';
  const failed = record.status === 'FAILED';
  const percent = Math.round(record.progress * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-muted-foreground">
          {record.format.replace('_', ' ')} · {record.resolutionW}×{record.resolutionH} · {record.fps} fps
          {record.watermark ? ' · watermarked' : ''}
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} />
            <span className="text-sm text-muted-foreground">
              Started {new Date(record.createdAt).toLocaleString()}
            </span>
          </div>

          {!done && !failed ? (
            <>
              <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${Math.max(4, percent)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {percent}% · this typically finishes in under two minutes.
              </p>
            </>
          ) : null}

          {done && record.downloadUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <a href={record.downloadUrl} download>
                <Button leftIcon={<Download className="h-4 w-4" />}>Download video</Button>
              </a>
              <Button
                variant="outline"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => setPublishOpen(true)}
              >
                Publish
              </Button>
              <span className="text-xs text-muted-foreground">
                {formatBytes(record.sizeBytes)} · link expires{' '}
                {record.expiresAt ? new Date(record.expiresAt).toLocaleDateString() : 'in 7 days'}
              </span>
            </div>
          ) : null}

          {publishOpen ? (
            <PublishDialog
              exportId={record.id}
              defaultTitle="My new short"
              onClose={() => setPublishOpen(false)}
            />
          ) : null}

          {failed ? (
            <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
              <p className="font-medium text-danger">Export failed</p>
              <p className="mt-1 text-danger/90">{record.errorMessage ?? 'Unknown error'}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => void refresh()}>
                  Retry
                </Button>
                <Link href={`/projects/${projectId}`}>
                  <Button size="sm" variant="ghost">
                    Back to editor
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED')
    return (
      <Badge tone="success">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </Badge>
    );
  if (status === 'FAILED')
    return (
      <Badge tone="danger">
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  return (
    <Badge tone="info">
      <Loader2 className="h-3 w-3 animate-spin" /> {status.toLowerCase()}
    </Badge>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb > 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}
