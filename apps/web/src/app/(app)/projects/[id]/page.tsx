import { notFound } from 'next/navigation';

import { EditorShell } from '@/components/editor/EditorShell';
import { serverClient } from '@/lib/sdk';
import type { EditorClip, EditorTrack } from '@/state/editor-store';

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
): Promise<{
  title: string;
  aspectRatio: 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5';
  durationMs: number;
  tracks: EditorTrack[];
}> {
  const sdk = serverClient();
  try {
    const timeline = (await sdk.getTimeline(projectId)) as unknown as {
      durationMs: number;
      tracks: Array<{
        id: string;
        kind: EditorTrack['kind'];
        index: number;
        muted: boolean;
        locked: boolean;
        volume: number;
        clips: Array<{
          id: string;
          trackId: string;
          source: EditorClip['source'];
          assetId: string | null;
          voiceoverId: string | null;
          startMs: number;
          durationMs: number;
          inMs: number;
          outMs: number;
          speed: number;
          volume: number;
          opacity: number;
          isHighlight: boolean;
          previewUrl: string | null;
          thumbnailUrl: string | null;
        }>;
      }>;
    };

    return {
      title: project.title,
      aspectRatio: project.aspectRatio as 'R9_16' | 'R16_9' | 'R1_1' | 'R4_5',
      durationMs: timeline.durationMs || project.durationMs,
      tracks: timeline.tracks.map((t) => ({
        id: t.id,
        kind: t.kind,
        index: t.index,
        muted: t.muted,
        locked: t.locked,
        volume: t.volume,
        clips: t.clips.map((c) => ({
          id: c.id,
          source: c.source,
          assetId: c.assetId,
          voiceoverId: c.voiceoverId,
          startMs: c.startMs,
          durationMs: c.durationMs,
          inMs: c.inMs,
          outMs: c.outMs,
          speed: c.speed,
          volume: c.volume,
          opacity: c.opacity,
          isHighlight: c.isHighlight,
          previewUrl: c.previewUrl,
          thumbnailUrl: c.thumbnailUrl,
        })),
      })),
    };
  } catch {
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
}
