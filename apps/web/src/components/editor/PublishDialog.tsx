'use client';

import { CheckCircle2, ExternalLink, Loader2, Youtube } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, CardContent, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Target {
  id: string;
  provider: string;
  displayName: string | null;
  providerAccountId: string;
}

interface Props {
  exportId: string;
  defaultTitle: string;
  onClose: () => void;
}

export function PublishDialog({ exportId, defaultTitle, onClose }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void clientSdk()
      .listPublishTargets()
      .then((res) => {
        const items = res.items as unknown as Target[];
        setTargets(items);
        if (items.length > 0) setTargetId(items[0]!.id);
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    if (!targetId) return;
    setSubmitting(true);
    setErr(null);
    try {
      const tags = tagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 20);
      await clientSdk().requestPublish({
        exportId,
        targetId,
        title,
        description,
        tags,
        privacy,
      });
      setSubmitted(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal>
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Publish this video</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-sm"
              aria-label="Close"
            >
              Close
            </button>
          </div>

          {loading ? (
            <div className="grid place-items-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : targets.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>You haven't connected a platform yet.</p>
              <a
                href="/settings/publishing"
                className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
              >
                Connect one <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : submitted ? (
            <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> Queued for publish
              </div>
              <p className="text-muted-foreground">
                We'll notify you when the platform confirms the post. You can watch progress on the{' '}
                <a href="/publish/history" className="text-brand-700 hover:text-brand-800">
                  publish history
                </a>{' '}
                page.
              </p>
              <div className="pt-2 text-right">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Destination</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {targets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetId(t.id)}
                      className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                        targetId === t.id
                          ? 'border-brand-400 bg-brand-50/50'
                          : 'border-border hover:border-brand-200'
                      }`}
                    >
                      <ProviderGlyph provider={t.provider} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.provider.toLowerCase()}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.displayName ?? t.providerAccountId}
                        </p>
                      </div>
                      {targetId === t.id ? <Badge tone="brand">Selected</Badge> : null}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Title</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Tags</span>
                <Input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="comma or newline separated"
                />
              </label>

              <div>
                <span className="text-sm font-medium">Privacy</span>
                <div className="mt-1.5 flex gap-1">
                  {(['public', 'unlisted', 'private'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrivacy(p)}
                      className={`flex-1 h-9 text-sm rounded border capitalize ${
                        privacy === p
                          ? 'border-brand-400 bg-brand-100 text-brand-800'
                          : 'border-border bg-surface hover:bg-surface-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {err ? <p className="text-sm text-danger">{err}</p> : null}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={submit} loading={submitting} disabled={!targetId || !title}>
                  Publish
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderGlyph({ provider }: { provider: string }) {
  if (provider === 'YOUTUBE') return <Youtube className="h-5 w-5 text-red-600" />;
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M15.5 3v10.7a3.8 3.8 0 1 1-3.8-3.8v3.3a.9.9 0 1 0 .9.9V3h2.9zM20 8.4a5.6 5.6 0 0 1-3.8-1.5V4a4.6 4.6 0 0 0 3.8 3.4v1z" />
    </svg>
  );
}
