/**
 * E2E: Browse flow (PRD v6 — UAT-U1, UAT-U4, UAT-U5, UAT-U9).
 * Root or /browse → map; Routes opens Explore panel; route list in panel; click route → drawer.
 */
import { test, expect } from '@playwright/test';

test.describe('Browse flow', () => {
  test('root redirects to /browse', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/browse/, { timeout: 5_000 });
  });

  test('visitor can open Routes panel and open a route from the list', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('button', { name: /^Routes$/i })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /^Routes$/i }).click();
    const panel = page.getByRole('complementary', { name: /explore routes|routes/i });
    await panel.waitFor({ state: 'visible', timeout: 5_000 });

    const noRoutes = page.getByText('No routes found');
    const firstRouteCard = panel.locator('[role="button"]').first();
    await noRoutes.or(firstRouteCard).waitFor({ state: 'visible', timeout: 10_000 });

    if (await noRoutes.isVisible().catch(() => false)) {
      await expect(noRoutes).toBeVisible();
      return;
    }
    await expect(firstRouteCard).toBeVisible({ timeout: 5_000 });
    await firstRouteCard.click();
    await expect(page).toHaveURL(/\/routes\/[^/]+$/, { timeout: 10_000 });
    await expect(page.locator('[role="dialog"], h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });
});
