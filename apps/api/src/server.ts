import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
} from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './config/env';
import { buildHelmetOptions } from './config/security';
import { logger } from './lib/logger';
import { registerMetrics } from './lib/metrics';
import { errorHandler } from './middleware/error';
import { registerIdempotency } from './middleware/idempotency';
import { adminRoutes } from './routes/admin.routes';
import { assetsRoutes } from './routes/assets.routes';
import { authRoutes } from './routes/auth.routes';
import { billingRoutes } from './routes/billing.routes';
import { captionsRoutes } from './routes/captions.routes';
import { generationRoutes } from './routes/generation.routes';
import { healthRoutes } from './routes/health.routes';
import { insightsRoutes } from './routes/insights.routes';
import { internalRoutes } from './routes/internal.routes';
import { notificationsRoutes } from './routes/notifications.routes';
import { projectsRoutes } from './routes/projects.routes';
import { publicRoutes } from './routes/public.routes';
import { publishRoutes } from './routes/publish.routes';
import { rankingRoutes } from './routes/ranking.routes';
import { supportRoutes } from './routes/support.routes';
import { templatesRoutes } from './routes/templates.routes';
import { testRoutes } from './routes/test.routes';
import { timelineRoutes } from './routes/timeline.routes';
import { uploadsRoutes } from './routes/uploads.routes';
import { usersRoutes } from './routes/users.routes';
import { voicesRoutes } from './routes/voices.routes';
import { wsRoutes } from './routes/ws.routes';

export async function buildServer(): Promise<FastifyInstance> {
  // Passing a live pino Logger to Fastify narrows the `Logger` generic on
  // the returned instance to pino.Logger; downstream helpers (registerMetrics,
  // registerIdempotency, route plugins) expect the default FastifyBaseLogger.
  // Cast the injected logger so the whole app graph agrees on one type.
  const app = Fastify({
    logger: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
    bodyLimit: 10_485_760,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Every route declares its body/params/query as Zod objects. Without a
  // matching validator + serializer compiler Fastify assumes JSON-schema
  // and blows up at boot with FST_ERR_SCH_VALIDATION_BUILD.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(helmet, buildHelmetOptions());
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : [env.WEB_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
  });
  await app.register(cookie, { hook: 'onRequest' });
  await app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_API_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.auth?.sub ?? req.ip,
  });
  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: env.UPLOAD_MAX_BYTES } });

  if (env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'VideoRankingStudio API',
          description: 'Internal HTTP + WebSocket API',
          version: '0.1.0',
        },
        servers: [{ url: env.API_URL }],
      },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.setErrorHandler(errorHandler);

  await registerMetrics(app);
  registerIdempotency(app);
  await app.register(healthRoutes);
  await app.register(publicRoutes, { prefix: '/v1' });
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(usersRoutes, { prefix: '/v1' });
  await app.register(projectsRoutes, { prefix: '/v1' });
  await app.register(timelineRoutes, { prefix: '/v1' });
  await app.register(captionsRoutes, { prefix: '/v1' });
  await app.register(generationRoutes, { prefix: '/v1' });
  await app.register(uploadsRoutes, { prefix: '/v1' });
  await app.register(assetsRoutes, { prefix: '/v1' });
  await app.register(templatesRoutes, { prefix: '/v1' });
  await app.register(voicesRoutes, { prefix: '/v1' });
  await app.register(billingRoutes, { prefix: '/v1' });
  await app.register(publishRoutes, { prefix: '/v1' });
  await app.register(rankingRoutes, { prefix: '/v1' });
  await app.register(supportRoutes, { prefix: '/v1' });
  await app.register(notificationsRoutes, { prefix: '/v1' });
  await app.register(adminRoutes, { prefix: '/v1' });
  await app.register(insightsRoutes, { prefix: '/v1' });
  await app.register(internalRoutes, { prefix: '/v1' });
  await app.register(testRoutes, { prefix: '/v1' });
  await app.register(wsRoutes, { prefix: '/v1' });

  app.get('/', async () => ({
    name: 'VideoRankingStudio API',
    version: '0.1.0',
    docs: env.NODE_ENV !== 'production' ? '/docs' : undefined,
  }));

  return app;
}
