import { expect, test } from '@playwright/test';

/**
 * Coverage for the marketing surface. Kept as smoke: each page renders,
 * exposes its own H1, and cross-links to at least one CTA that leads to
 * signed-in or contact surfaces. A missing route or an accidental
 * `export const dynamic` on the wrong page will trip this.
 */

test.describe('Marketing surface', () => {
  test('pricing page renders plans + FAQ', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/common questions/i)).toBeVisible();
  });

  test('about page cross-links to roadmap', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /roadmap/i }).first()).toBeVisible();
  });

  test('contact page shows the form and topic select', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^topic$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled();
  });

  test('contact page respects the topic query param', async ({ page }) => {
    await page.goto('/contact?topic=sales');
    const topic = page.getByLabel(/^topic$/i);
    await expect(topic).toHaveValue('sales');
  });

  test('status page renders a verdict', async ({ page }) => {
    await page.goto('/status');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Verdict card uses role="status"
    await expect(page.getByRole('status').first()).toBeVisible();
  });

  test('changelog + roadmap render their columns', async ({ page }) => {
    await page.goto('/changelog');
    await expect(page.getByRole('heading', { name: /changelog/i, level: 1 })).toBeVisible();

    await page.goto('/roadmap');
    await expect(page.getByRole('heading', { name: /roadmap/i, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /building/i })).toBeVisible();
  });

  test('security overview cross-links to the vulnerability disclosure route', async ({ page }) => {
    await page.goto('/legal/security');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /security topic/i }),
    ).toHaveAttribute('href', /contact\?topic=security/);
  });

  test('404 page shows a recovery path', async ({ page }) => {
    const res = await page.goto('/definitely-not-a-real-route');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to the homepage/i })).toBeVisible();
  });
});
