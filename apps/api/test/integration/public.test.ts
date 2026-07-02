import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { closeTestApp, getTestApp } from '../helpers/app';
import { sendContactMessage } from '../../src/services/contact.service';

// The contact endpoint hands off to the email transport. We don't want the
// integration suite pushing real SMTP traffic, so we stub the service. Every
// other route we exercise (`/public/status`, `/public/version`) touches only
// real dependencies (Postgres, Redis) already provisioned by CI.
vi.mock('../../src/services/contact.service', () => ({
  sendContactMessage: vi.fn().mockResolvedValue(undefined),
}));

describe('public routes', () => {
  beforeAll(async () => {
    await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /v1/public/contact', () => {
    it('accepts a well-formed message', async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/public/contact',
        payload: {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          topic: 'sales',
          message: 'I am evaluating VideoRankingStudio for a small team.',
        },
      });
      expect(res.statusCode).toBe(202);
      expect(res.json()).toEqual({ ok: true });
      expect(sendContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          topic: 'sales',
          message: expect.stringContaining('evaluating'),
        }),
      );
    });

    it('rejects a body missing required fields', async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/public/contact',
        payload: { name: '', email: 'not-an-email', message: 'short' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { error: { code: string } };
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('short-circuits to 202 without sending when the honeypot is filled', async () => {
      const app = await getTestApp();
      vi.mocked(sendContactMessage).mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/v1/public/contact',
        payload: {
          name: 'Bot McBotface',
          email: 'bot@example.com',
          topic: 'general',
          message: 'This message should never leave the API.',
          website: 'https://spam.example.com',
        },
      });
      expect(res.statusCode).toBe(202);
      expect(sendContactMessage).not.toHaveBeenCalled();
    });
  });

  describe('GET /v1/public/status', () => {
    it('returns component-level status with a rolled-up verdict', async () => {
      const app = await getTestApp();
      const res = await app.inject({ method: 'GET', url: '/v1/public/status' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        status: string;
        updatedAt: string;
        components: Array<{ key: string; label: string; status: string }>;
      };
      expect(['operational', 'degraded', 'down']).toContain(body.status);
      expect(new Date(body.updatedAt).toString()).not.toBe('Invalid Date');
      const keys = body.components.map((c) => c.key);
      expect(keys).toContain('api');
      expect(keys).toContain('database');
      expect(keys).toContain('redis');
    });
  });

  describe('GET /v1/public/version', () => {
    it('returns a version marker', async () => {
      const app = await getTestApp();
      const res = await app.inject({ method: 'GET', url: '/v1/public/version' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { version: string; commit: string; environment: string };
      expect(body.version).toBeTruthy();
      expect(body.commit).toBeTruthy();
      expect(body.environment).toBeTruthy();
    });
  });
});
