import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  createClipSchema,
  createTrackSchema,
  moveClipSchema,
  reorderClipsSchema,
  splitClipSchema,
  updateClipSchema,
  updateTrackSchema,
} from '@vrs/types';

import { requireAuth } from '../middleware/auth';
import * as timeline from '../services/timeline.service';

const idParams = z.object({ id: z.string() });
const trackParams = z.object({ id: z.string(), trackId: z.string() });
const clipParams = z.object({ id: z.string(), clipId: z.string() });

export async function timelineRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Full timeline (used by editor server component + save-round-trip).
  app.get('/projects/:id/timeline', {
    schema: { tags: ['timeline'], params: idParams },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      return timeline.getTimeline(req.auth!.sub, id);
    },
  });

  // ─── Tracks ───────────────────────────────────────────────────────────
  app.post('/projects/:id/tracks', {
    schema: { tags: ['timeline'], params: idParams, body: createTrackSchema },
    handler: async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const body = createTrackSchema.parse(req.body);
      reply.code(201);
      return timeline.createTrack(req.auth!.sub, id, body);
    },
  });

  app.patch('/projects/:id/tracks/:trackId', {
    schema: { tags: ['timeline'], params: trackParams, body: updateTrackSchema },
    handler: async (req) => {
      const { id, trackId } = trackParams.parse(req.params);
      const body = updateTrackSchema.parse(req.body);
      return timeline.updateTrack(req.auth!.sub, id, trackId, body);
    },
  });

  app.delete('/projects/:id/tracks/:trackId', {
    schema: { tags: ['timeline'], params: trackParams },
    handler: async (req, reply) => {
      const { id, trackId } = trackParams.parse(req.params);
      await timeline.deleteTrack(req.auth!.sub, id, trackId);
      reply.code(204).send();
    },
  });

  // ─── Clips ────────────────────────────────────────────────────────────
  app.post('/projects/:id/clips', {
    schema: { tags: ['timeline'], params: idParams, body: createClipSchema },
    handler: async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const body = createClipSchema.parse(req.body);
      reply.code(201);
      return timeline.createClip(req.auth!.sub, id, body);
    },
  });

  app.patch('/projects/:id/clips/:clipId', {
    schema: { tags: ['timeline'], params: clipParams, body: updateClipSchema },
    handler: async (req) => {
      const { id, clipId } = clipParams.parse(req.params);
      const body = updateClipSchema.parse(req.body);
      return timeline.updateClip(req.auth!.sub, id, clipId, body);
    },
  });

  app.post('/projects/:id/clips/:clipId/move', {
    schema: { tags: ['timeline'], params: clipParams, body: moveClipSchema },
    handler: async (req) => {
      const { id, clipId } = clipParams.parse(req.params);
      const body = moveClipSchema.parse(req.body);
      return timeline.moveClip(req.auth!.sub, id, clipId, body);
    },
  });

  app.post('/projects/:id/clips/:clipId/split', {
    schema: { tags: ['timeline'], params: clipParams, body: splitClipSchema },
    handler: async (req) => {
      const { id, clipId } = clipParams.parse(req.params);
      const body = splitClipSchema.parse(req.body);
      return timeline.splitClip(req.auth!.sub, id, clipId, body.atMs);
    },
  });

  app.delete('/projects/:id/clips/:clipId', {
    schema: { tags: ['timeline'], params: clipParams },
    handler: async (req, reply) => {
      const { id, clipId } = clipParams.parse(req.params);
      await timeline.deleteClip(req.auth!.sub, id, clipId);
      reply.code(204).send();
    },
  });

  app.post('/projects/:id/clips/reorder', {
    schema: { tags: ['timeline'], params: idParams, body: reorderClipsSchema },
    handler: async (req) => {
      const { id } = idParams.parse(req.params);
      const body = reorderClipsSchema.parse(req.body);
      return timeline.reorderClips(req.auth!.sub, id, body);
    },
  });
}
