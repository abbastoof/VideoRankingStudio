'use client';

import { Captions, FileVideo, Image as ImageIcon, Mic2, Scissors, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Spinner, cn } from '@vrs/ui';

import { CaptionEditor } from '@/components/editor/CaptionEditor';
import { clientSdk } from '@/lib/client-sdk';
import { useEditorStore } from '@/state/editor-store';

type Panel = 'media' | 'highlights' | 'captions' | 'voice' | 'script' | 'image';

export function Sidebar({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState<Panel>('media');

  return (
    <aside className="w-[320px] border-l border-border bg-surface overflow-y-auto flex flex-col">
      <nav className="flex border-b border-border" aria-label="Editor tools">
        <Tab icon={<FileVideo className="h-4 w-4" />} label="Media" active={open === 'media'} onClick={() => setOpen('media')} />
        <Tab icon={<Scissors className="h-4 w-4" />} label="Highlights" active={open === 'highlights'} onClick={() => setOpen('highlights')} />
        <Tab icon={<Captions className="h-4 w-4" />} label="Captions" active={open === 'captions'} onClick={() => setOpen('captions')} />
        <Tab icon={<Mic2 className="h-4 w-4" />} label="Voice" active={open === 'voice'} onClick={() => setOpen('voice')} />
        <Tab icon={<Sparkles className="h-4 w-4" />} label="AI" active={open === 'script' || open === 'image'} onClick={() => setOpen('script')} />
      </nav>

      <div className="flex-1 p-4 space-y-4">
        {open === 'media' ? <MediaPanel projectId={projectId} /> : null}
        {open === 'highlights' ? <HighlightsPanel projectId={projectId} /> : null}
        {open === 'captions' ? <CaptionsPanel projectId={projectId} /> : null}
        {open === 'voice' ? <VoicePanel projectId={projectId} /> : null}
        {open === 'script' ? <ScriptPanel projectId={projectId} /> : null}
      </div>
    </aside>
  );
}

function Tab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
        active ? 'bg-brand-100 text-brand-800' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function useLibraryAssets(projectId: string) {
  const [assets, setAssets] = useState<
    Array<{ id: string; kind: string; url: string | null; thumbnailUrl: string | null; durationMs: number | null }>
  >([]);
  useEffect(() => {
    void clientSdk()
      .listAssets({ projectId, limit: 50 })
      .then((res) =>
        setAssets(
          res.items.map((a) => ({
            id: a.id,
            kind: a.kind,
            url: a.url,
            thumbnailUrl: a.thumbnailUrl,
            durationMs: a.durationMs,
          })),
        ),
      )
      .catch(() => setAssets([]));
  }, [projectId]);
  return assets;
}

function MediaPanel({ projectId }: { projectId: string }) {
  const addClip = useEditorStore((s) => s.addClip);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const assets = useLibraryAssets(projectId);

  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const sdk = clientSdk();
      const init = await sdk.initUpload({
        projectId,
        kind: file.type.startsWith('audio') ? 'AUDIO' : file.type.startsWith('image') ? 'IMAGE' : 'VIDEO',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      const res = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const asset = await sdk.completeUpload({ assetId: init.assetId });
      addClip(asset.kind === 'AUDIO' ? 'AUDIO' : 'VIDEO', {
        source: 'ASSET',
        assetId: asset.id,
        voiceoverId: null,
        startMs: 0,
        durationMs: asset.durationMs ?? 10_000,
        inMs: 0,
        outMs: asset.durationMs ?? 10_000,
        speed: 1,
        volume: 1,
        opacity: 1,
        isHighlight: false,
        previewUrl: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function importViaUrl() {
    if (!importUrl) return;
    setErr(null);
    try {
      await clientSdk().importFromUrl({ projectId, url: importUrl, audioOnly: false });
      setImportUrl('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add media</h3>
          <label className="block rounded-md border-2 border-dashed border-border bg-surface-muted p-5 text-center cursor-pointer hover:border-brand-300 transition-colors">
            {uploading ? <Spinner /> : <FileVideo className="mx-auto h-5 w-5 text-muted-foreground" />}
            <p className="mt-2 text-xs">Drop or click to upload</p>
            <input
              type="file"
              className="sr-only"
              accept="video/*,audio/*,image/*"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
            />
          </label>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Or import by URL</p>
            <input
              type="url"
              placeholder="https://…"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <Button size="sm" fullWidth onClick={importViaUrl} disabled={!importUrl}>
              Import
            </Button>
          </div>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
        </CardContent>
      </Card>

      {assets.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold">Project library</h3>
            <div className="grid grid-cols-3 gap-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="aspect-square rounded-md border border-border bg-surface-muted overflow-hidden hover:border-brand-300"
                  onClick={() =>
                    addClip(a.kind === 'AUDIO' ? 'AUDIO' : 'VIDEO', {
                      source: 'ASSET',
                      assetId: a.id,
                      voiceoverId: null,
                      startMs: 0,
                      durationMs: a.durationMs ?? 8000,
                      inMs: 0,
                      outMs: a.durationMs ?? 8000,
                      speed: 1,
                      volume: 1,
                      opacity: 1,
                      isHighlight: false,
                      previewUrl: a.url,
                      thumbnailUrl: a.thumbnailUrl,
                    })
                  }
                  aria-label="Add to timeline"
                >
                  {a.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-2xs text-muted-foreground">
                      {a.kind.slice(0, 3)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function HighlightsPanel({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const assets = useLibraryAssets(projectId);

  useEffect(() => {
    if (!assetId && assets.length > 0) setAssetId(assets.find((a) => a.kind === 'VIDEO')?.id ?? null);
  }, [assets, assetId]);

  async function run() {
    if (!assetId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await clientSdk().generateHighlights(projectId, {
        assetId,
        targetDurationMs: 60_000,
        maxClips: 8,
        includeFaceTracking: true,
      });
      useEditorStore.getState().setJob(res.jobId, {
        kind: 'HIGHLIGHT_DETECTION',
        status: 'QUEUED',
        progress: 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start detection');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Auto highlights</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Scans the loudest, most-cut moments and proposes ranked clips. Best on recordings 5 minutes or longer.
          </p>
          <select
            className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm"
            value={assetId ?? ''}
            onChange={(e) => setAssetId(e.target.value || null)}
          >
            <option value="">Pick a source video…</option>
            {assets
              .filter((a) => a.kind === 'VIDEO')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id.slice(0, 12)}…
                </option>
              ))}
          </select>
          <Button size="sm" fullWidth loading={busy} onClick={run} disabled={!assetId}>
            Detect highlights
          </Button>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CaptionsPanel({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [language, setLanguage] = useState('auto');
  const [tab, setTab] = useState<'generate' | 'edit'>('generate');

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await clientSdk().generateTranscription(projectId, { language, diarize: false });
      useEditorStore.getState().setJob(res.jobId, {
        kind: 'TRANSCRIPTION',
        status: 'QUEUED',
        progress: 0,
      });
      setTab('edit');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start transcription');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-md bg-surface-muted p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('generate')}
          className={cn('flex-1 py-1 rounded transition-colors', tab === 'generate' ? 'bg-background shadow' : 'text-muted-foreground')}
        >
          Generate
        </button>
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={cn('flex-1 py-1 rounded transition-colors', tab === 'edit' ? 'bg-background shadow' : 'text-muted-foreground')}
        >
          Edit
        </button>
      </div>

      {tab === 'generate' ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Captions className="h-4 w-4 text-brand-700" />
              <h3 className="text-sm font-semibold">Auto captions</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Word-level timing in 90+ languages. Edit any word and the burn-in updates instantly.
            </p>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm"
            >
              <option value="auto">Detect language</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
            </select>
            <Button size="sm" fullWidth loading={busy} onClick={run}>
              Generate captions
            </Button>
            {err ? <p className="text-xs text-danger">{err}</p> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="h-[520px]">
          <CaptionEditor projectId={projectId} />
        </div>
      )}
    </div>
  );
}

const STOCK_VOICES = [
  { id: 'stock-narrator-male-us', label: 'Atlas — US, male' },
  { id: 'stock-narrator-female-us', label: 'Nova — US, female' },
  { id: 'stock-narrator-male-uk', label: 'Wells — UK, male' },
  { id: 'stock-narrator-female-uk', label: 'Harper — UK, female' },
  { id: 'stock-newsreader-neutral', label: 'Field — neutral' },
];

function VoicePanel({ projectId }: { projectId: string }) {
  const [script, setScript] = useState('');
  const [voiceKey, setVoiceKey] = useState(STOCK_VOICES[0]!.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [voiceIds, setVoiceIds] = useState<Record<string, string>>({});

  // Voice DB rows are indexed by (provider, providerVoiceId). We resolve the
  // internal Voice.id by looking through the seeded list once.
  useEffect(() => {
    void fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/voices`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Array<{ id: string; providerVoiceId?: string }> }) => {
        const map: Record<string, string> = {};
        for (const v of data.items ?? []) {
          if (v.providerVoiceId) map[v.providerVoiceId] = v.id;
        }
        setVoiceIds(map);
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    if (!script) return;
    setBusy(true);
    setErr(null);
    try {
      const voiceId = voiceIds[voiceKey];
      if (!voiceId) {
        // Fall back to sending the provider id — the API resolves either.
      }
      const res = await clientSdk().generateVoiceover(projectId, {
        voiceId: voiceId ?? voiceKey,
        scriptText: script,
        speed: 1.0,
        pitch: 0,
      });
      useEditorStore.getState().setJob(res.jobId, {
        kind: 'VOICEOVER',
        status: 'QUEUED',
        progress: 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate voiceover');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Voiceover</h3>
          </div>
          <select
            value={voiceKey}
            onChange={(e) => setVoiceKey(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm"
          >
            {STOCK_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            placeholder="What should the narrator say?"
            className="w-full rounded-md border border-border bg-surface-raised p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <p className="text-xs text-muted-foreground">{script.length} characters</p>
          <Button size="sm" fullWidth disabled={!script} loading={busy} onClick={run}>
            Generate voiceover
          </Button>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ScriptPanel({ projectId }: { projectId: string }) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<'neutral' | 'casual' | 'energetic' | 'educational' | 'dramatic'>('neutral');
  const [format, setFormat] = useState<'listicle' | 'story' | 'commentary' | 'tutorial' | 'ranking'>('listicle');
  const [busy, setBusy] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function genScript() {
    if (!topic) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await clientSdk().generateScript(projectId, {
        topic,
        tone,
        format,
        durationMs: 60_000,
        language: 'en',
      });
      useEditorStore.getState().setJob(res.jobId, { kind: 'SCRIPT_GENERATE', status: 'QUEUED', progress: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate');
    } finally {
      setBusy(false);
    }
  }

  async function genImage() {
    if (!imagePrompt) return;
    setImgBusy(true);
    setErr(null);
    try {
      const res = await clientSdk().generateImage(projectId, {
        prompt: imagePrompt,
        width: 1024,
        height: 1024,
        count: 1,
      });
      useEditorStore.getState().setJob(res.jobId, { kind: 'IMAGE_GENERATE', status: 'QUEUED', progress: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate image');
    } finally {
      setImgBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Script generator</h3>
          </div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic or angle"
            className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              className="h-9 rounded-md border border-border bg-surface-raised px-2 text-sm"
            >
              <option value="neutral">Neutral</option>
              <option value="casual">Casual</option>
              <option value="energetic">Energetic</option>
              <option value="educational">Educational</option>
              <option value="dramatic">Dramatic</option>
            </select>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="h-9 rounded-md border border-border bg-surface-raised px-2 text-sm"
            >
              <option value="listicle">Listicle</option>
              <option value="story">Story</option>
              <option value="commentary">Commentary</option>
              <option value="tutorial">Tutorial</option>
              <option value="ranking">Ranking</option>
            </select>
          </div>
          <Button size="sm" fullWidth disabled={!topic} loading={busy} onClick={genScript}>
            Generate
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">AI b-roll</h3>
          </div>
          <input
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder="Describe an image"
            className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <Button size="sm" fullWidth loading={imgBusy} disabled={!imagePrompt} onClick={genImage}>
            Generate image
          </Button>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
