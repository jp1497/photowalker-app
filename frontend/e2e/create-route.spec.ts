/**
 * E2E: Create route flow (UAT-FR1, FR2).
 * Auth (test login) -> create route -> view route.
 */
import { test, expect } from '@playwright/test';
import { e2eLogin } from './helpers';

test.describe('Create route flow', () => {
  test.beforeEach(async ({ page }) => {
    await e2eLogin(page);
  });

  test('authenticated user can create a route and view it', async ({ page }) => {
    await page.goto('/routes/create');
    await expect(page.getByRole('heading', { name: /create a route/i })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/title/i).fill('E2E Test Route');
    await page.getByLabel(/public/i).check();
    await page.getByTestId('create-route-e2e-set-line').click();

    await page.getByRole('button', { name: /create route/i }).click();
    await expect(page).toHaveURL(/\/routes\/(?!create$)[^/]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /create a route/i })).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Loading route...')).not.toBeVisible({ timeout: 15_000 });

    const photosHeading = page.getByRole('heading', { name: 'Photos' });
    const errorH2 = page.getByRole('heading', { level: 2 }).filter({ hasText: /Route not found|Private route|^Error$/i });
    await photosHeading.or(errorH2).waitFor({ state: 'visible', timeout: 15_000 });

    if (await errorH2.isVisible().catch(() => false)) {
      throw new Error(`Route detail failed: ${await errorH2.textContent()}. Ensure backend is running.`);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/E2E Test Route/);
  });
});
