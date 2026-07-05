import Redis from 'ioredis';

import { env } from './env';
import { logger } from '../lib/logger';

let _redis: Redis | undefined;
let _pubsub: Redis | undefined;
let _broker: Redis | undefined;

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

/**
 * Connection for publishing Celery tasks. This MUST target the same Redis
 * database the workers consume (BROKER_URL) — the cache connection points at
 * REDIS_URL, typically a different db index, and messages pushed there sit
 * unprocessed forever.
 */
export function getBrokerRedis(): Redis {
  if (_broker) return _broker;
  const url =
    env.BROKER_URL && env.BROKER_URL.startsWith('redis')
      ? env.BROKER_URL
      : env.REDIS_QUEUE_URL ?? env.REDIS_URL;
  _broker = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  _broker.on('error', (err) => logger.error({ err }, 'redis broker error'));
  return _broker;
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
  await Promise.all([_redis?.quit(), _pubsub?.quit(), _broker?.quit()]);
  _redis = undefined;
  _pubsub = undefined;
  _broker = undefined;
}
