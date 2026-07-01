'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { clientSdk } from '@/lib/client-sdk';
import { useEditorStore, type EditorTrack } from '@/state/editor-store';
import { connectJobStream } from '@/state/job-stream';
import { markInitialSnapshot, startAutosave } from '@/state/timeline-sync';

import { JobProgressStrip } from './JobProgressStrip';
import { Preview } from './Preview';
import { Sidebar } from './Sidebar';
import { Timeline, useKeyboardShortcuts } from './Timeline';
import { Toolbar } from './Toolbar';

interface EditorShellProps {
  projectId: string;
  initialState: {
    title: string;
    aspectRatio: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5';
    durationMs: number;
    tracks: EditorTrack[];
  };
}

export function EditorShell({ projectId, initialState }: EditorShellProps) {
  const router = useRouter();
  const hydrate = useEditorStore((s) => s.hydrate);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (hydratedFor.current === projectId) return;
    hydratedFor.current = projectId;
    hydrate({
      projectId,
      title: initialState.title,
      aspectRatio: initialState.aspectRatio,
      durationMs: initialState.durationMs,
      tracks: initialState.tracks,
      playheadMs: 0,
      playing: false,
      selectedClipId: null,
      selectedTrackId: null,
    });
    markInitialSnapshot();
  }, [projectId, initialState, hydrate]);

  useEffect(() => {
    const stopAutosave = startAutosave(projectId);
    const stream = connectJobStream(projectId);
    return () => {
      stopAutosave();
      stream.close();
    };
  }, [projectId]);

  useKeyboardShortcuts();

  // Command palette shortcuts for undo/redo/save (registered here so we can
  // hook into the router for post-export navigation).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (cmd && (e.key === 'y' || (e.shiftKey && e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  async function save() {
    // Autosave already handles ambient persistence. This forces an immediate
    // sync by nudging the dirty flag.
    useEditorStore.setState({ dirty: true });
  }

  async function exportVideo() {
    const sdk = clientSdk();
    const out = await sdk.requestExport(projectId, {
      format: 'MP4_H264',
      resolutionW: 1080,
      resolutionH: 1920,
      fps: 30,
      burnCaptions: true,
      normalizeLoudness: true,
    });
    router.push(`/projects/${projectId}/exports/${out.exportId}`);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      <Toolbar onSave={save} onExport={exportVideo} />
      <JobProgressStrip />
      <div className="flex flex-1 min-h-0">
        <Preview />
        <Sidebar projectId={projectId} />
      </div>
      <Timeline />
    </div>
  );
}
