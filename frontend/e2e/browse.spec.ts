/**
 * E2E: Browse flow (UAT-FR4, FR5).
 * View browse -> select route -> view route.
 * If no public routes exist, asserts empty state; otherwise clicks first route and checks detail.
 */
import { test, expect } from '@playwright/test';

test.describe('Browse flow', () => {
  test('visitor can open browse and view list; if routes exist, can open one', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: 'List' }).click();

    const noRoutes = page.getByText('No routes found');
    const firstRouteItem = page.locator('ul li').first();
    await noRoutes.or(firstRouteItem).waitFor({ state: 'visible', timeout: 10_000 });

    if (await noRoutes.isVisible().catch(() => false)) {
      await expect(noRoutes).toBeVisible();
      return;
    }
    await expect(firstRouteItem).toBeVisible({ timeout: 10_000 });
    await firstRouteItem.click();
    await expect(page).toHaveURL(/\/routes\/[^/]+$/, { timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });
});
