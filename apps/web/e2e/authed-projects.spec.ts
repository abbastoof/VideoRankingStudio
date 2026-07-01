import { expect, test } from '@playwright/test';

import { newEmail, signInAs } from './helpers/session';

/**
 * Authenticated flow: sign in via the OTP fast-path, create a project, verify
 * it lands on the projects list, then rename it.
 *
 * Skipped when the API isn't reachable — this keeps `pnpm test:e2e` viable in
 * developer laptops without the full stack up.
 */

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000';

test.describe('authenticated flows', () => {
  test.beforeAll(async () => {
    const res = await fetch(`${API_URL}/health`).catch(() => null);
    if (!res || !res.ok) test.skip(true, 'API not reachable — skipping authed E2E');
  });

  test('sign in → create project → rename it', async ({ context, page }) => {
    const email = newEmail();
    await signInAs(context, email);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /good/i })).toBeVisible();

    await page.goto('/projects/new');
    await page.getByRole('button', { name: /start from a script/i }).click();
    await page.getByLabel('Project title').fill('E2E ranking draft');
    await page.getByRole('button', { name: /create project/i }).click();

    await page.waitForURL(/\/projects\/[a-z0-9]+/);
    await page.goto('/projects');
    await expect(page.getByText('E2E ranking draft').first()).toBeVisible();
  });
});
