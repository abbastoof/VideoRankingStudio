import Redis from 'ioredis';

import { env } from './env';
import { logger } from '../lib/logger';

let _redis: Redis | undefined;
let _pubsub: Redis | undefined;

export function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  _redis.on('error', (err) => logger.error({ err }, 'redis error'));
  return _redis;
}

export function getRedisPubSub(): Redis {
  if (_pubsub) return _pubsub;
  // PubSub needs its own connection — it can't share with command clients.
  _pubsub = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  _pubsub.on('error', (err) => logger.error({ err }, 'redis pubsub error'));
  return _pubsub;
}

export async function closeRedis(): Promise<void> {
  await Promise.all([_redis?.quit(), _pubsub?.quit()]);
  _redis = undefined;
  _pubsub = undefined;
}
