/**
 * E2E: Upload photo flow (UAT-FR1, FR2, FR3).
 * Auth -> create route -> upload photo -> view route with photo.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { e2eLogin } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Upload photo flow', () => {
  test.beforeEach(async ({ page }) => {
    await e2eLogin(page);
  });

  test('authenticated user can create route, upload photo, and see it on route detail', async ({ page }) => {
    await page.goto('/routes/create');
    await expect(page.getByRole('heading', { name: /create a route/i })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/title/i).fill('E2E Photo Route');
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
    await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Add photos' }).click();

    const fileInput = page.locator('input[type="file"]#photo-file');
    await expect(fileInput).toBeVisible({ timeout: 5_000 });
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'photo-with-gps.jpg'));

    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('No photos yet')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator('section ul li').first()).toBeVisible({ timeout: 5_000 });
  });
});
