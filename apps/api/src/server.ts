import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error';
import { authRoutes } from './routes/auth.routes';
import { healthRoutes } from './routes/health.routes';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    bodyLimit: 10_485_760, // 10 MiB JSON cap; uploads go direct to S3
    genReqId: (req) =>
      (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
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
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1' });

  app.get('/', async () => ({
    name: 'VideoRankingStudio API',
    version: '0.1.0',
    docs: env.NODE_ENV !== 'production' ? '/docs' : undefined,
  }));

  return app;
}
