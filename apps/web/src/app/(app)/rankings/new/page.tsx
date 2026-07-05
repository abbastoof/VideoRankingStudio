'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

export default function NewRankingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'R9_16' | 'R16_9' | 'R1_1' | 'R4_5'>('R9_16');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const out = await clientSdk().createRanking({ title, aspectRatio, order });
      router.push(`/rankings/${out.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create ranking');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New ranking</h1>
        <p className="text-sm text-muted-foreground">
          Compare a set of items (products, videos, songs, players) and produce a
          ranked, animated short.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>What are you ranking?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Title</span>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Top-selling running shoes of 2026"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Aspect ratio</span>
                <Select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                >
                  <option value="R9_16">Vertical (9:16)</option>
                  <option value="R1_1">Square (1:1)</option>
                  <option value="R4_5">Portrait (4:5)</option>
                  <option value="R16_9">Landscape (16:9)</option>
                </Select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Order</span>
                <Select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
                  <option value="desc">Highest score first</option>
                  <option value="asc">Lowest score first</option>
                </Select>
              </label>
            </div>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!title}>
                Create ranking
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
