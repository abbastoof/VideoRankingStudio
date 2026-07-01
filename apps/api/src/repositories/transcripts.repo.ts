import type { Prisma } from '@vrs/db';

import { prisma } from '../config/db';

export function findTranscript(userId: string, transcriptId: string) {
  return prisma.transcript.findFirst({
    where: { id: transcriptId, project: { userId } },
    include: { segments: { orderBy: { index: 'asc' } } },
  });
}

export function listTranscriptsForProject(userId: string, projectId: string) {
  return prisma.transcript.findMany({
    where: { projectId, project: { userId } },
    orderBy: { createdAt: 'desc' },
    include: { segments: { orderBy: { index: 'asc' } } },
  });
}

export function updateSegment(
  transcriptId: string,
  segmentId: string,
  data: Prisma.TranscriptSegmentUpdateInput,
) {
  return prisma.transcriptSegment.updateMany({
    where: { id: segmentId, transcriptId },
    data,
  });
}

export function createSegment(
  transcriptId: string,
  data: Omit<Prisma.TranscriptSegmentCreateInput, 'transcript'>,
) {
  return prisma.transcriptSegment.create({
    data: { ...data, transcript: { connect: { id: transcriptId } } },
  });
}

export function deleteSegment(transcriptId: string, segmentId: string) {
  return prisma.transcriptSegment.deleteMany({
    where: { id: segmentId, transcriptId },
  });
}

export function replaceContentText(transcriptId: string, contentText: string) {
  return prisma.transcript.update({
    where: { id: transcriptId },
    data: { contentText },
  });
}
