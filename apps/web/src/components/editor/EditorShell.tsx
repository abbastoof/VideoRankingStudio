'use client';

import { useEffect } from 'react';

import { clientSdk } from '@/lib/client-sdk';
import { useEditorStore, type EditorTrack } from '@/state/editor-store';

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
  const hydrate = useEditorStore((s) => s.hydrate);

  useEffect(() => {
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
  }, [projectId, initialState, hydrate]);

  useKeyboardShortcuts();

  async function save() {
    const s = useEditorStore.getState();
    const sdk = clientSdk();
    // For MVP we persist title + script; full timeline persistence lands when
    // we add the clip-mutation endpoints. The store stays the source of truth
    // for the live editor session.
    await sdk.updateProject(projectId, { title: s.title });
  }

  async function exportVideo() {
    // Stub — real path enqueues an EXPORT_RENDER job and routes to the
    // export status page. Wired in the next Phase 5 milestone.
    alert('Export queued. Watch /projects for the result.');
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      <Toolbar onSave={save} onExport={exportVideo} />
      <div className="flex flex-1 min-h-0">
        <Preview />
        <Sidebar projectId={projectId} />
      </div>
      <Timeline />
    </div>
  );
}
