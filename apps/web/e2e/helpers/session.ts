import { randomBytes } from 'node:crypto';

import type { BrowserContext, Page } from '@playwright/test';

/**
 * Authenticated E2E helper.
 *
 * The API's OTP flow requires an email delivery leg (Mailhog in dev). Rather
 * than reach into Mailhog we drive the same server code paths a browser would:
 *   1. request an OTP,
 *   2. override the code hash directly in the DB with a known value,
 *   3. verify with that code,
 *   4. attach the returned cookies to the Playwright context.
 *
 * The helper requires the API to be reachable and the test DB to have Prisma
 * migrations applied. It's a no-op in CI environments without those services
 * (skipped upstream).
 */

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000';

export interface EphemeralUser {
  email: string;
  cleanup: () => Promise<void>;
}

export function newEmail(): string {
  return `e2e-${randomBytes(6).toString('hex')}@vrs.test`;
}

async function fetchJson(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

/**
 * Sign in via OTP. Depends on the test harness having planted a known code
 * hash for the requested email; the test-only endpoint at
 * `/v1/_test/plant-otp` is exposed only when NODE_ENV=test.
 */
export async function signInAs(context: BrowserContext, email: string): Promise<void> {
  await fetchJson('/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'SIGN_IN' }),
  });

  const plantRes = await fetchJson('/v1/_test/plant-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code: '424242' }),
  });
  if (!plantRes.ok) {
    throw new Error(
      `Test harness endpoint /_test/plant-otp not available (${plantRes.status}). ` +
        `Boot the API with NODE_ENV=test to enable it.`,
    );
  }

  const verify = await fetchJson('/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code: '424242' }),
  });
  if (!verify.ok) throw new Error(`otp verify failed: ${verify.status}`);

  const setCookie = verify.headers.get('set-cookie');
  if (!setCookie) throw new Error('verify returned no Set-Cookie header');
  const cookies = parseSetCookie(setCookie);
  await context.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: 'localhost',
      path: '/',
    })),
  );
}

export async function signOut(page: Page): Promise<void> {
  await page.request.post(`${API_URL}/v1/auth/signout`);
}

function parseSetCookie(raw: string): Array<{ name: string; value: string }> {
  return raw.split(/,\s*(?=[a-zA-Z0-9_-]+=)/).map((cookie) => {
    const [pair] = cookie.split(';');
    const [name, ...rest] = pair!.split('=');
    return { name: name!.trim(), value: rest.join('=').trim() };
  });
}
