import type { Prisma } from '@vrs/db';
import type { CreateProject, ProjectListQuery, UpdateProject } from '@vrs/types';

import { prisma } from '../config/db';
import { Errors } from '../lib/errors';
import * as projectsRepo from '../repositories/projects.repo';
import * as usage from './usage.service';

function aspectFromZodEnum(v: CreateProject['aspectRatio']) {
  return v; // schema enum matches Prisma enum 1:1
}

export async function listProjects(userId: string, query: ProjectListQuery) {
  const { items, nextCursor } = await projectsRepo.listProjectsForUser({
    userId,
    cursor: query.cursor,
    limit: query.limit,
    status: query.status,
    type: query.type,
    search: query.search,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  });
  return {
    items: items.map((p) => ({
      ...p,
      thumbnailUrl: null, // resolved via CDN at presigned-url layer when present
      lastEditedAt: p.lastEditedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function createProject(userId: string, body: CreateProject) {
  // Atomic quota reservation. Prevents two concurrent creates from both
  // slipping past the "check" phase of a legacy check-then-act pair.
  await usage.assertAndIncrement(userId, 'VIDEOS_CREATED', 1);

  if (body.templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: body.templateId } });
    if (!tpl) {
      // Roll back the quota reservation so a bad templateId doesn't consume
      // one of the user's monthly slots.
      await usage.increment(userId, 'VIDEOS_CREATED', -1);
      throw Errors.notFound('Template');
    }
  }

  try {
    const project = await projectsRepo.createProject(userId, {
      title: body.title,
      type: body.type,
      aspectRatio: aspectFromZodEnum(body.aspectRatio),
      templateId: body.templateId,
      scriptText: body.scriptText,
    });
    return serializeSummary(project);
  } catch (err) {
    await usage.increment(userId, 'VIDEOS_CREATED', -1);
    throw err;
  }
}

export async function getProject(userId: string, id: string) {
  const project = await projectsRepo.findProject(userId, id);
  if (!project) throw Errors.projectNotFound();
  return serializeFull(project);
}

export async function updateProject(userId: string, id: string, body: UpdateProject) {
  const res = await projectsRepo.updateProject(userId, id, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.aspectRatio !== undefined ? { aspectRatio: body.aspectRatio } : {}),
    ...(body.scriptText !== undefined ? { scriptText: body.scriptText } : {}),
    ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
    ...(body.settingsJson !== undefined
      ? { settingsJson: body.settingsJson as Prisma.InputJsonValue }
      : {}),
  });
  if (res.count === 0) throw Errors.projectNotFound();
  return getProject(userId, id);
}

export async function deleteProject(userId: string, id: string) {
  const count = await projectsRepo.softDeleteProject(userId, id);
  if (count === 0) throw Errors.projectNotFound();
}

export async function duplicateProject(userId: string, id: string) {
  await usage.assertAndIncrement(userId, 'VIDEOS_CREATED', 1);
  let copy: Awaited<ReturnType<typeof projectsRepo.duplicateProject>> = null;
  try {
    copy = await projectsRepo.duplicateProject(userId, id);
  } catch (err) {
    await usage.increment(userId, 'VIDEOS_CREATED', -1);
    throw err;
  }
  if (!copy) {
    await usage.increment(userId, 'VIDEOS_CREATED', -1);
    throw Errors.projectNotFound();
  }
  return serializeSummary(copy);
}

function serializeSummary(p: Awaited<ReturnType<typeof projectsRepo.createProject>>) {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    aspectRatio: p.aspectRatio,
    durationMs: p.durationMs,
    thumbnailUrl: null,
    pinned: p.pinned,
    lastEditedAt: p.lastEditedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeFull(p: NonNullable<Awaited<ReturnType<typeof projectsRepo.findProject>>>) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    type: p.type,
    status: p.status,
    aspectRatio: p.aspectRatio,
    durationMs: p.durationMs,
    thumbnailUrl: null,
    scriptText: p.scriptText,
    settingsJson: p.settingsJson as Record<string, unknown>,
    pinned: p.pinned,
    templateId: p.templateId,
    lastEditedAt: p.lastEditedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
