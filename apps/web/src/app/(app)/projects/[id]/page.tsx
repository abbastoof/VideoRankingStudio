import { notFound } from 'next/navigation';

import { EditorShell } from '@/components/editor/EditorShell';
import { serverClient } from '@/lib/sdk';
import type { EditorTrack } from '@/state/editor-store';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function ProjectEditorPage({ params }: PageProps) {
  const sdk = serverClient();
  let project;
  try {
    project = await sdk.getProject(params.id);
  } catch {
    notFound();
  }
  if (!project) notFound();

  const initialState = await loadTimeline(params.id, project);

  return (
    <div className="-m-6 md:-m-8">
      <EditorShell projectId={params.id} initialState={initialState} />
    </div>
  );
}

async function loadTimeline(
  projectId: string,
  project: { title: string; aspectRatio: string; durationMs: number },
): Promise<{ title: string; aspectRatio: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5'; durationMs: number; tracks: EditorTrack[] }> {
  // The internal timeline endpoint is what the export worker uses, but the
  // browser session can call it too — we proxy through the same /v1/projects/
  // surface as soon as a `GET /v1/projects/:id/timeline` route lands. For now
  // we render an empty timeline shell; clips get added through the editor
  // mutations and will be persisted by upcoming clip routes.
  return {
    title: project.title,
    aspectRatio: project.aspectRatio as 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5',
    durationMs: project.durationMs,
    tracks: [
      { id: `t-${projectId}-v`, kind: 'VIDEO', index: 0, muted: false, locked: false, volume: 1, clips: [] },
      { id: `t-${projectId}-a`, kind: 'AUDIO', index: 0, muted: false, locked: false, volume: 1, clips: [] },
      { id: `t-${projectId}-c`, kind: 'CAPTION', index: 0, muted: false, locked: false, volume: 1, clips: [] },
    ],
  };
}
