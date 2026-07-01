'use client';

import { ArrowDown, ArrowUp, Download, GripVertical, Plus, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, Button, Card, CardContent, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Candidate {
  id: string;
  title: string;
  subtitle: string | null;
  score: number;
  assetId: string | null;
  thumbnailKey: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
}

interface Ranking {
  projectId: string;
  title: string;
  aspectRatio: string;
  order: 'asc' | 'desc';
  headerText: string | null;
  brandColor: string | null;
  reveal: 'countdown' | 'topfirst';
  candidates: Candidate[];
}

export function RankingEditor({ initial }: { initial: Ranking }) {
  const router = useRouter();
  const [ranking, setRanking] = useState<Ranking>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New-candidate form state.
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newScore, setNewScore] = useState('0');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  async function refresh() {
    const data = await clientSdk().getRanking(ranking.projectId);
    setRanking(data as unknown as Ranking);
  }

  async function addCandidate() {
    if (!newTitle.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().addRankingCandidate(ranking.projectId, {
        title: newTitle.trim(),
        subtitle: newSubtitle.trim() || null,
        score: Number(newScore) || 0,
        sourceUrl: newSourceUrl.trim() || null,
      });
      setNewTitle('');
      setNewSubtitle('');
      setNewScore('0');
      setNewSourceUrl('');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add candidate');
    } finally {
      setBusy(false);
    }
  }

  async function updateScore(c: Candidate, next: number) {
    setRanking((r) => ({
      ...r,
      candidates: r.candidates.map((x) => (x.id === c.id ? { ...x, score: next } : x)),
    }));
    await clientSdk().updateRankingCandidate(ranking.projectId, c.id, { score: next });
    await refresh();
  }

  async function updateTitle(c: Candidate, next: string) {
    setRanking((r) => ({
      ...r,
      candidates: r.candidates.map((x) => (x.id === c.id ? { ...x, title: next } : x)),
    }));
    await clientSdk().updateRankingCandidate(ranking.projectId, c.id, { title: next });
  }

  async function updateSubtitle(c: Candidate, next: string) {
    setRanking((r) => ({
      ...r,
      candidates: r.candidates.map((x) => (x.id === c.id ? { ...x, subtitle: next } : x)),
    }));
    await clientSdk().updateRankingCandidate(ranking.projectId, c.id, { subtitle: next || null });
  }

  async function removeCandidate(id: string) {
    if (!confirm('Remove this candidate?')) return;
    await clientSdk().deleteRankingCandidate(ranking.projectId, id);
    await refresh();
  }

  async function move(id: string, dir: 'up' | 'down') {
    const idx = ranking.candidates.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= ranking.candidates.length) return;
    const next = ranking.candidates.slice();
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setRanking({ ...ranking, candidates: next });
    await clientSdk().reorderRankingCandidates(
      ranking.projectId,
      next.map((c) => c.id),
    );
  }

  async function updateMeta(patch: Partial<Pick<Ranking, 'order' | 'headerText' | 'brandColor' | 'reveal'>>) {
    setRanking((r) => ({ ...r, ...patch }));
    await clientSdk().updateRanking(ranking.projectId, patch);
  }

  async function bakeAndOpenEditor() {
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().bakeRanking(ranking.projectId);
      router.push(`/projects/${ranking.projectId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not bake');
      setBusy(false);
    }
  }

  async function bakeAndExport() {
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().bakeRanking(ranking.projectId);
      const dims = aspectDims(ranking.aspectRatio);
      const out = await clientSdk().requestExport(ranking.projectId, {
        format: 'MP4_H264',
        resolutionW: dims.w,
        resolutionH: dims.h,
        fps: 30,
        burnCaptions: true,
        normalizeLoudness: true,
      });
      router.push(`/projects/${ranking.projectId}/exports/${out.exportId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not export');
      setBusy(false);
    }
  }

  const sorted = ranking.candidates.slice().sort((a, b) =>
    ranking.order === 'asc' ? a.score - b.score : b.score - a.score,
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ranking.title}</h1>
          <p className="text-sm text-muted-foreground">
            {ranking.candidates.length} candidate{ranking.candidates.length === 1 ? '' : 's'} · aspect{' '}
            {formatAspect(ranking.aspectRatio)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={bakeAndOpenEditor} loading={busy}>
            Open in editor
          </Button>
          <Button onClick={bakeAndExport} loading={busy} leftIcon={<Download className="h-4 w-4" />}>
            Bake &amp; export
          </Button>
        </div>
      </header>

      {err ? <p className="text-sm text-danger">{err}</p> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold">Add candidate</h2>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                />
                <Input
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="Subtitle (optional)"
                />
                <Input
                  type="number"
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  placeholder="Score"
                />
              </div>
              <Input
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="Source URL (optional)"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={addCandidate}
                  disabled={!newTitle.trim()}
                  loading={busy}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add candidate
                </Button>
              </div>
            </CardContent>
          </Card>

          {sorted.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No candidates yet. Add a few above to see the ranking come to life.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {sorted.map((c, i) => {
                const rank = ranking.reveal === 'topfirst' ? i + 1 : sorted.length - i;
                return (
                  <li key={c.id}>
                    <Card>
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="w-10 shrink-0 grid place-items-center text-lg font-semibold text-brand-700 font-mono">
                          #{i + 1}
                        </div>
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-surface-muted overflow-hidden">
                          {c.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 grid gap-1.5 sm:grid-cols-[1fr_1fr_120px]">
                          <Input
                            defaultValue={c.title}
                            onBlur={(e) => void updateTitle(c, e.target.value)}
                          />
                          <Input
                            defaultValue={c.subtitle ?? ''}
                            placeholder="Subtitle"
                            onBlur={(e) => void updateSubtitle(c, e.target.value)}
                          />
                          <Input
                            type="number"
                            defaultValue={c.score}
                            onBlur={(e) => void updateScore(c, Number(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            aria-label="Move up"
                            onClick={() => void move(c.id, 'up')}
                            className="p-1 rounded hover:bg-surface-muted"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            onClick={() => void move(c.id, 'down')}
                            className="p-1 rounded hover:bg-surface-muted"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeCandidate(c.id)}
                          aria-label="Remove"
                          className="p-1.5 text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Badge tone={rank <= 3 ? 'brand' : 'neutral'}>rank {rank}</Badge>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-brand-700" />
                <h2 className="text-sm font-semibold">Style</h2>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Reveal order</span>
                <select
                  value={ranking.reveal}
                  onChange={(e) => void updateMeta({ reveal: e.target.value as 'countdown' | 'topfirst' })}
                  className="h-9 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
                >
                  <option value="countdown">Countdown to #1</option>
                  <option value="topfirst">Top item first</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Score order</span>
                <select
                  value={ranking.order}
                  onChange={(e) => void updateMeta({ order: e.target.value as 'asc' | 'desc' })}
                  className="h-9 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
                >
                  <option value="desc">Highest first</option>
                  <option value="asc">Lowest first</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Intro header</span>
                <Input
                  defaultValue={ranking.headerText ?? ''}
                  placeholder="e.g. Top 10 running shoes"
                  onBlur={(e) => void updateMeta({ headerText: e.target.value || null })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Accent color</span>
                <input
                  type="color"
                  defaultValue={ranking.brandColor ?? '#111111'}
                  onBlur={(e) => void updateMeta({ brandColor: e.target.value })}
                  className="h-9 w-full rounded-md border border-border bg-surface-raised"
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">How this exports</p>
              <p>
                Each candidate becomes an animated overlay card. Attach an asset to a candidate to use it
                as the background for that slot.
              </p>
              <p>
                &quot;Bake &amp; export&quot; regenerates the timeline from your candidates before
                queueing the render.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function aspectDims(a: string): { w: number; h: number } {
  return (
    {
      R9_16: { w: 1080, h: 1920 },
      R1_1: { w: 1080, h: 1080 },
      R4_5: { w: 1080, h: 1350 },
      R16_9: { w: 1920, h: 1080 },
    }[a as 'R9_16' | 'R1_1' | 'R4_5' | 'R16_9'] ?? { w: 1080, h: 1920 }
  );
}

function formatAspect(a: string): string {
  return a.replace(/^R/, '').replace('_', ':');
}
