import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export async function errorHandler(
  err: FastifyError | AppError | ZodError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const requestId = req.id;

  if (err instanceof AppError) {
    const body = {
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Something went wrong on our end',
        requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, route: req.routeOptions.url }, 'app error');
    } else {
      logger.info({ code: err.code, requestId, route: req.routeOptions.url }, 'handled error');
    }
    await reply.code(err.statusCode).send(body);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    await reply.code(400).send({
      error: {
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
        requestId,
        details: { issues: details },
      },
    });
    return;
  }

  const fastifyErr = err as FastifyError;
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    await reply.code(fastifyErr.statusCode).send({
      error: {
        code: fastifyErr.code ?? 'BAD_REQUEST',
        message: fastifyErr.message,
        requestId,
      },
    });
    return;
  }

  logger.error({ err, requestId, route: req.routeOptions.url }, 'unhandled error');
  await reply.code(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end',
      requestId,
    },
  });
}
