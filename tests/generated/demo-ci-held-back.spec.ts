import { test, expect } from '@playwright/test';

// DEMO (throwaway): two problems the pre-run check can see in the code alone.
test('DEMO CI: the home page shows the welcome heading', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toContainText('Welcome');
});
