import { afterAll, describe, expect, it } from 'vitest';

import { closeTestApp, getTestApp } from '../helpers/app';

describe('health endpoints', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /health returns ok', async () => {
    const app = await getTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'api' });
  });

  it('GET / returns metadata', async () => {
    const app = await getTestApp();
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string; version: string };
    expect(body.name).toBe('VideoRankingStudio API');
    expect(body.version).toBeTruthy();
  });
});
