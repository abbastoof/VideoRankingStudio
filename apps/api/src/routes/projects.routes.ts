import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  createProjectSchema,
  pageOf,
  projectListQuerySchema,
  projectSummarySchema,
  updateProjectSchema,
} from '@vrs/types';

import { requireAuth } from '../middleware/auth';
import * as projectsService from '../services/projects.service';

const projectFullSchema = projectSummarySchema.extend({
  description: z.string().nullable(),
  scriptText: z.string().nullable(),
  settingsJson: z.record(z.unknown()),
  templateId: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export async function projectsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/projects', {
    schema: {
      tags: ['projects'],
      querystring: projectListQuerySchema,
      response: { 200: pageOf(projectSummarySchema) },
    },
    handler: async (req) => {
      const query = projectListQuerySchema.parse(req.query);
      return projectsService.listProjects(req.auth!.sub, query);
    },
  });

  app.post('/projects', {
    schema: {
      tags: ['projects'],
      body: createProjectSchema,
      response: { 201: projectSummarySchema },
    },
    handler: async (req, reply) => {
      const body = createProjectSchema.parse(req.body);
      const project = await projectsService.createProject(req.auth!.sub, body);
      reply.code(201);
      return project;
    },
  });

  app.get('/projects/:id', {
    schema: {
      tags: ['projects'],
      params: z.object({ id: z.string() }),
      response: { 200: projectFullSchema },
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      return projectsService.getProject(req.auth!.sub, id);
    },
  });

  app.patch('/projects/:id', {
    schema: {
      tags: ['projects'],
      params: z.object({ id: z.string() }),
      body: updateProjectSchema,
      response: { 200: projectFullSchema },
    },
    handler: async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = updateProjectSchema.parse(req.body);
      return projectsService.updateProject(req.auth!.sub, id, body);
    },
  });

  app.delete('/projects/:id', {
    schema: {
      tags: ['projects'],
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
    handler: async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      await projectsService.deleteProject(req.auth!.sub, id);
      reply.code(204).send();
    },
  });

  app.post('/projects/:id/duplicate', {
    schema: {
      tags: ['projects'],
      params: z.object({ id: z.string() }),
      response: { 201: projectSummarySchema },
    },
    handler: async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const copy = await projectsService.duplicateProject(req.auth!.sub, id);
      reply.code(201);
      return copy;
    },
  });
}
