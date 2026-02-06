import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E test login via "Test sign in (E2E)" button.
 * Requires backend E2E_TEST_SECRET and frontend VITE_E2E_MODE + VITE_E2E_SECRET.
 */
export async function e2eLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-e2e-test-signin')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('login-e2e-test-signin').click();
  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 }),
    page.getByText('Test sign in failed').waitFor({ state: 'visible', timeout: 15_000 }).then(() => null),
  ]);
  if (page.url().includes('/login')) {
    const sawError = await page.getByText('Test sign in failed').isVisible();
    throw new Error(
      sawError
        ? 'Test login failed. Start backend (cd backend && .venv/bin/uvicorn app.main:app --reload), set E2E_TEST_SECRET in backend/.env and VITE_E2E_MODE=true, VITE_E2E_SECRET in frontend/.env.local.'
        : 'Test login did not navigate. Start backend and set E2E env vars.'
    );
  }
}
