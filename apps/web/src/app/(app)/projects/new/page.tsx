'use client';

import { FileVideo, Link2, Sparkles, Type, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

type Mode = 'choose' | 'upload' | 'url' | 'script' | 'template';

export default function NewProjectPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = (params.get('mode') ?? 'choose') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Start a new project</h1>
        <p className="text-sm text-muted-foreground">
          Pick a starting point. You can switch sources after the project is created.
        </p>
      </header>

      {mode === 'choose' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            icon={<Upload className="h-5 w-5" />}
            title="Upload footage"
            description="Drop in a video or audio file (up to 5 GB)."
            onClick={() => setMode('upload')}
          />
          <ModeCard
            icon={<Link2 className="h-5 w-5" />}
            title="Import from URL"
            description="YouTube, TikTok, Instagram, or any public video URL."
            onClick={() => setMode('url')}
          />
          <ModeCard
            icon={<Type className="h-5 w-5" />}
            title="Start from a script"
            description="Type or paste a script — the AI will produce voice and scenes."
            onClick={() => setMode('script')}
          />
          <ModeCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Use a template"
            description="Pre-filled formats: listicles, rankings, stories, tutorials."
            onClick={() => router.push('/templates')}
          />
        </div>
      ) : null}

      {mode === 'upload' ? <UploadFlow onBack={() => setMode('choose')} /> : null}
      {mode === 'url' ? <UrlImportFlow onBack={() => setMode('choose')} /> : null}
      {mode === 'script' ? <ScriptFlow onBack={() => setMode('choose')} /> : null}
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-surface-raised p-5 hover:border-brand-400 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 group-hover:bg-brand-200">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function UploadFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('Untitled project');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const sdk = clientSdk();
      const project = await sdk.createProject({ title, type: 'SHORTS', aspectRatio: 'R9_16' });
      const init = await sdk.initUpload({
        projectId: project.id,
        kind: file.type.startsWith('audio') ? 'AUDIO' : 'VIDEO',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await uploadWithProgress(init.uploadUrl, file, setProgress);
      await sdk.completeUpload({ assetId: init.assetId });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a file</CardTitle>
        <CardDescription>MP4, MOV, MKV, WebM, MP3, or WAV. Up to 5 GB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="title" className="text-sm font-medium">Project title</label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label
          htmlFor="file"
          className="block rounded-lg border-2 border-dashed border-border bg-surface-muted hover:border-brand-300 hover:bg-brand-50/50 p-10 text-center cursor-pointer transition-colors"
        >
          <FileVideo className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            {file ? file.name : 'Click to choose a file'}
          </p>
          <p className="text-xs text-muted-foreground">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'or drag and drop'}
          </p>
          <input
            id="file"
            type="file"
            accept="video/*,audio/*"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {progress > 0 && progress < 1 ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={start} disabled={!file} loading={busy}>
            Start upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UrlImportFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('Imported video');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!url.startsWith('http')) {
      setErr('Enter a full URL.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const sdk = clientSdk();
      const project = await sdk.createProject({ title, type: 'IMPORT', aspectRatio: 'R9_16' });
      await sdk.importFromUrl({ projectId: project.id, url, audioOnly: false });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from a URL</CardTitle>
        <CardDescription>
          We fetch the video on our servers and notify you when it's ready to edit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="title" className="text-sm font-medium">Project title</label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="url" className="text-sm font-medium">Video URL</label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            leftIcon={<Link2 className="h-4 w-4" />}
          />
        </div>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={start} loading={busy}>Import and continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScriptFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('Untitled project');
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const sdk = clientSdk();
      const project = await sdk.createProject({
        title,
        type: 'TEXT_STORY',
        aspectRatio: 'R9_16',
        scriptText: script,
      });
      router.push(`/projects/${project.id}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start from a script</CardTitle>
        <CardDescription>
          Paste or write the script. The editor will generate voiceover and pull b-roll for each beat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="title" className="text-sm font-medium">Project title</label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="script" className="text-sm font-medium">Script</label>
          <textarea
            id="script"
            rows={12}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your script, or type a few lines and we'll expand it after."
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={start} loading={busy}>Create project</Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (frac: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
