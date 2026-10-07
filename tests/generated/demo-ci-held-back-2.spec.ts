import { test, expect } from '@playwright/test';

// DEMO 2 (throwaway): two problems the pre-run check can see in the code alone.
test('DEMO CI 2: the home page shows the welcome heading', async ({ page }) => {
  // Open the home page first, then assert on what it renders.
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  // A real check instead of a check that can never fail.
  await expect(page.locator('body')).not.toBeEmpty();
});
