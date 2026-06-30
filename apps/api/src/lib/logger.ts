import pino, { type Logger } from 'pino';

import { env } from '../config/env';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-service-token"]',
  '*.password',
  '*.secret',
  '*.token',
  '*.code',
  '*.codeHash',
  '*.refreshToken',
  '*.accessToken',
  '*.apiKey',
  'stripeSecretKey',
];

const isPretty = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api', env: env.NODE_ENV },
  redact: { paths: redactPaths, censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: isPretty
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', singleLine: false },
      }
    : undefined,
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
