import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/config/db';
import { closeTestApp, getTestApp, readCookie } from '../helpers/app';
import { resetDb, seedPlanIfMissing } from '../helpers/db';

describe('OTP auth flow', () => {
  beforeEach(async () => {
    await resetDb();
    await seedPlanIfMissing();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('issues an OTP for a new email', async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      payload: { email: 'new@example.com', purpose: 'SIGN_UP' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { delivered: boolean; expiresInSeconds: number };
    expect(body.delivered).toBe(true);
    expect(body.expiresInSeconds).toBeGreaterThan(0);

    const otp = await prisma.otpCode.findFirst({
      where: { email: 'new@example.com' },
    });
    expect(otp).toBeTruthy();
    expect(otp?.consumedAt).toBeNull();
  });

  it('rejects an invalid code and increments attempts', async () => {
    const app = await getTestApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      payload: { email: 'user@example.com', purpose: 'SIGN_IN' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '000000' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('OTP_INVALID');

    const otp = await prisma.otpCode.findFirst({
      where: { email: 'user@example.com' },
    });
    expect(otp?.attempts).toBeGreaterThan(0);
  });

  it('sets cookies on successful verification', async () => {
    const app = await getTestApp();
    // Trigger the OTP row, then plant a known code hash so we can verify.
    // We do this by re-hashing the exact plaintext the service uses.
    await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      payload: { email: 'verify@example.com', purpose: 'SIGN_IN' },
    });

    // The stored hash is Argon2; we cheat by overriding the code hash with a
    // fresh known value.
    const argon2 = await import('argon2');
    const knownCode = '123456';
    const hash = await argon2.default.hash(knownCode, { type: argon2.default.argon2id });
    await prisma.otpCode.updateMany({
      where: { email: 'verify@example.com' },
      data: { codeHash: hash, attempts: 0 },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'verify@example.com', code: knownCode },
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(readCookie(setCookie, process.env.SESSION_COOKIE_NAME ?? 'vrs_session')).toBeTruthy();
  });
});
