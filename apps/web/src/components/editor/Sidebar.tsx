'use client';

import { Captions, FileVideo, Image as ImageIcon, Mic2, Scissors, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, CardContent, Spinner, cn } from '@vrs/ui';

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

function MediaPanel({ projectId }: { projectId: string }) {
  const addClip = useEditorStore((s) => s.addClipToVideoTrack);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const sdk = clientSdk();
      const init = await sdk.initUpload({
        projectId,
        kind: file.type.startsWith('audio') ? 'AUDIO' : file.type.startsWith('image') ? 'IMAGE' : 'VIDEO',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const asset = await sdk.completeUpload({ assetId: init.assetId });
      addClip({
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
    } finally {
      setUploading(false);
    }
  }

  async function importViaUrl() {
    if (!importUrl) return;
    const sdk = clientSdk();
    await sdk.importFromUrl({ projectId, url: importUrl, audioOnly: false });
    setImportUrl('');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add media</h3>
          <label
            className="block rounded-md border-2 border-dashed border-border bg-surface-muted p-5 text-center cursor-pointer hover:border-brand-300 transition-colors"
          >
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
        </CardContent>
      </Card>
    </div>
  );
}

function HighlightsPanel({ projectId: _projectId }: { projectId: string }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Auto highlights</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Scans the loudest, most-cut moments and proposes ranked clips. Best on
            recordings 5 minutes or longer.
          </p>
          <Button size="sm" fullWidth>Detect highlights</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CaptionsPanel({ projectId: _projectId }: { projectId: string }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Auto captions</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Word-level timing in 90+ languages. Edit any word and the burn-in updates instantly.
          </p>
          <Button size="sm" fullWidth>Generate captions</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function VoicePanel({ projectId: _projectId }: { projectId: string }) {
  const [script, setScript] = useState('');
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">Voiceover</h3>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            placeholder="What should the narrator say?"
            className="w-full rounded-md border border-border bg-surface-raised p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <p className="text-xs text-muted-foreground">{script.length} / 1500 characters</p>
          <Button size="sm" fullWidth disabled={!script}>Generate voiceover</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ScriptPanel({ projectId: _projectId }: { projectId: string }) {
  const [topic, setTopic] = useState('');
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
          <Button size="sm" fullWidth disabled={!topic}>Generate</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-brand-700" />
            <h3 className="text-sm font-semibold">AI b-roll</h3>
          </div>
          <input
            placeholder="Describe an image"
            className="w-full h-9 rounded-md border border-border bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <Button size="sm" fullWidth>Generate image</Button>
        </CardContent>
      </Card>
    </div>
  );
}
