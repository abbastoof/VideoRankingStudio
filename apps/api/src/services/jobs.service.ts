import type { AiJobKind } from '@vrs/db';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import { childLogger } from '../lib/logger';
import { publishCeleryTask } from './queue.service';

interface EnqueueOpts {
  userId: string;
  projectId?: string;
  kind: AiJobKind;
  taskName: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}

export async function enqueue(opts: EnqueueOpts) {
  const log = childLogger({ kind: opts.kind });

  if (opts.idempotencyKey) {
    const existing = await prisma.aiJob.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
    });
    if (existing) {
      log.info({ jobId: existing.id }, 'job.idempotent_replay');
      return existing;
    }
  }

  const job = await prisma.aiJob.create({
    data: {
      userId: opts.userId,
      projectId: opts.projectId ?? null,
      kind: opts.kind,
      status: 'QUEUED',
      priority: opts.priority ?? 50,
      maxAttempts: opts.maxAttempts ?? 3,
      payloadJson: opts.payload,
      idempotencyKey: opts.idempotencyKey ?? null,
    },
  });

  try {
    await publishCeleryTask({
      taskName: opts.taskName,
      kwargs: { ...opts.payload, job_id: job.id },
    });
    log.info({ jobId: job.id }, 'job.enqueued');
  } catch (err) {
    log.error({ err, jobId: job.id }, 'job.publish_failed');
    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorJson: { message: 'Broker publish failed' } },
    });
    throw Errors.internal('Could not enqueue the job — please retry');
  }

  return job;
}

export async function cancel(userId: string, jobId: string) {
  const job = await prisma.aiJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw Errors.notFound('Job');
  if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
    throw Errors.conflict('Job is not cancellable');
  }
  await prisma.aiJob.update({
    where: { id: jobId },
    data: { status: 'CANCELED', finishedAt: new Date() },
  });
}

export async function getJob(userId: string, jobId: string) {
  const job = await prisma.aiJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw Errors.notFound('Job');
  return {
    id: job.id,
    projectId: job.projectId,
    kind: job.kind,
    status: job.status,
    progress: 0,
    attempts: job.attempts,
    errorMessage: (job.errorJson as { message?: string } | null)?.message ?? null,
    resultJson: job.resultJson as Record<string, unknown> | null,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  };
}
