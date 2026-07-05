import { randomUUID } from 'node:crypto';

import { getBrokerRedis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Publish a task into Celery's wire protocol.
 *
 * We support two brokers without adding a heavy AMQP client:
 *   - REDIS (default when BROKER_URL is empty or starts with `redis://`)
 *   - RABBITMQ (BROKER_URL starts with `amqp://`) — uses a tiny amqplib import
 *     loaded lazily so dev installs that don't need RabbitMQ stay slim.
 *
 * Routing keys map onto the queues defined in `apps/workers/src/celery_app.py`.
 * Keep this list in sync with that file.
 */

const TASK_ROUTES: Record<string, string> = {
  'vrs.transcribe': 'transcription',
  'vrs.tts.generate': 'tts',
  'vrs.voice.clone': 'voice_clone',
  'vrs.highlights.detect': 'highlights',
  'vrs.image.generate': 'image_gen',
  'vrs.video.generate': 'video_gen',
  'vrs.script.generate': 'script_gen',
  'vrs.script.rewrite': 'script_gen',
  'vrs.import.url': 'import_url',
  'vrs.export.render': 'export',
  'vrs.thumbnail.generate': 'thumbnails',
  'vrs.publish.youtube': 'publish',
  'vrs.publish.tiktok': 'publish',
};

interface PublishOpts {
  taskName: string;
  kwargs: Record<string, unknown>;
  args?: unknown[];
  routingKey?: string;
  priority?: number;
}

export async function publishCeleryTask(opts: PublishOpts): Promise<string> {
  const taskId = randomUUID();
  const queue = opts.routingKey ?? TASK_ROUTES[opts.taskName] ?? 'default';
  const payload = celeryMessage(taskId, opts.taskName, opts.kwargs, opts.args);

  if (!env.BROKER_URL || env.BROKER_URL.startsWith('redis://')) {
    await publishViaRedis(queue, payload);
  } else if (env.BROKER_URL.startsWith('amqp://') || env.BROKER_URL.startsWith('amqps://')) {
    await publishViaAmqp(queue, payload, opts.priority);
  } else {
    throw new Error(`Unsupported BROKER_URL: ${env.BROKER_URL}`);
  }

  logger.debug({ taskId, taskName: opts.taskName, queue }, 'celery.published');
  return taskId;
}

function celeryMessage(
  taskId: string,
  taskName: string,
  kwargs: Record<string, unknown>,
  args: unknown[] = [],
): { properties: Record<string, unknown>; headers: Record<string, unknown>; body: string } {
  // Celery v2 message protocol — the body is a base64-encoded JSON tuple.
  const body = Buffer.from(JSON.stringify([args, kwargs, { callbacks: null, errbacks: null, chain: null, chord: null }])).toString('base64');
  return {
    properties: {
      correlation_id: taskId,
      content_type: 'application/json',
      content_encoding: 'utf-8',
      body_encoding: 'base64',
      delivery_info: { exchange: '', routing_key: 'default' },
      priority: 0,
      delivery_tag: taskId,
      delivery_mode: 2, // persistent
    },
    headers: {
      lang: 'py',
      task: taskName,
      id: taskId,
      shadow: null,
      eta: null,
      expires: null,
      group: null,
      retries: 0,
      timelimit: [null, null],
      root_id: taskId,
      parent_id: null,
      argsrepr: JSON.stringify(args),
      kwargsrepr: JSON.stringify(kwargs),
      origin: 'vrs.api',
    },
    body,
  };
}

async function publishViaRedis(queue: string, payload: ReturnType<typeof celeryMessage>): Promise<void> {
  const redis = getBrokerRedis();
  const envelope = {
    body: payload.body,
    'content-encoding': 'utf-8',
    'content-type': 'application/json',
    headers: payload.headers,
    properties: { ...payload.properties, body_encoding: 'base64' },
  };
  await redis.lpush(queue, JSON.stringify(envelope));
}

let _amqp: { conn: unknown; channel: unknown } | null = null;
async function publishViaAmqp(
  queue: string,
  payload: ReturnType<typeof celeryMessage>,
  priority?: number,
): Promise<void> {
  // Lazy import so the dependency isn't required when BROKER_URL=redis.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const amqplib = (await import('amqplib')) as typeof import('amqplib');
  if (!_amqp) {
    const conn = await amqplib.connect(env.BROKER_URL!);
    const channel = await conn.createConfirmChannel();
    _amqp = { conn, channel };
  }
  const channel = _amqp.channel as Awaited<ReturnType<Awaited<ReturnType<typeof amqplib.connect>>['createConfirmChannel']>>;
  await channel.assertQueue(queue, { durable: true });
  await new Promise<void>((resolve, reject) => {
    channel.publish(
      '',
      queue,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        deliveryMode: 2,
        priority: priority ?? 0,
        headers: payload.headers,
      },
      (err: unknown) =>
        err
          ? reject(err instanceof Error ? err : new Error(String(err)))
          : resolve(),
    );
  });
}
