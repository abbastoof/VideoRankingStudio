import { expect, test } from '@playwright/test';

test.describe('Landing → sign-in surface', () => {
  test('renders the landing hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('sign-in page collects an email', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await page.getByLabel(/email/i).fill('e2e@example.com');
    await expect(page.getByRole('button', { name: /send code/i })).toBeEnabled();
  });

  test('legal pages are reachable', async ({ page }) => {
    await page.goto('/legal/terms');
    await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
  });
});
