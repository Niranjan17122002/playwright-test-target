import { test, expect } from '@playwright/test';

test('POSITIVE: shows the loaded demo settings', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Settings loaded' })).toBeVisible({ timeout: 15000 });
});
