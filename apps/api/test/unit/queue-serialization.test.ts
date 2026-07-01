import { describe, expect, it } from 'vitest';

describe('Celery wire-protocol serialisation', () => {
  it('produces base64-encoded body under the redis envelope', async () => {
    // We test the pure serialisation shape without publishing anywhere.
    const { publishCeleryTask } = await import('../../src/services/queue.service');
    // Redis publish is a side effect — swap it out with a spy by monkey-patching
    // the redis client used by publishCeleryTask.
    const { getRedis } = await import('../../src/config/redis');
    const redis = getRedis();
    const original = redis.lpush.bind(redis);
    let captured: unknown = null;
    (redis as unknown as { lpush: typeof redis.lpush }).lpush = (async (queue: string, message: string) => {
      captured = { queue, message };
      return 1 as never;
    }) as never;
    try {
      await publishCeleryTask({
        taskName: 'vrs.transcribe',
        kwargs: { asset_key: 'x', job_id: 'j1' },
      });
      expect(captured).toBeTruthy();
      const parsed = JSON.parse((captured as { message: string }).message);
      expect(parsed.headers.task).toBe('vrs.transcribe');
      expect(parsed.properties.body_encoding).toBe('base64');
      const decoded = JSON.parse(Buffer.from(parsed.body, 'base64').toString('utf8'));
      expect(decoded[1].job_id).toBe('j1');
    } finally {
      (redis as unknown as { lpush: typeof redis.lpush }).lpush = original;
    }
  });
});
