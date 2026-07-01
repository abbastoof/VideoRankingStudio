import type { FastifyInstance } from 'fastify';

import { buildServer } from '../../src/server';

let _app: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (_app) return _app;
  _app = await buildServer();
  await _app.ready();
  return _app;
}

export async function closeTestApp(): Promise<void> {
  if (_app) {
    await _app.close();
    _app = null;
  }
}

/** Extract a cookie by name from Set-Cookie headers. */
export function readCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const [pair] = c.split(';');
    const [k, v] = pair!.split('=');
    if (k === name) return v ?? null;
  }
  return null;
}
