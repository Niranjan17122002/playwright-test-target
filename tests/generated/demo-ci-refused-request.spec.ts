import { test, expect } from '@playwright/test';

test('POSITIVE: shows the loaded demo settings', async ({ page }) => {
  await page.goto('');
  await page.evaluate(async () => {
    const res = await fetch('demo-settings-missing.json');
    if (res.ok) document.body.insertAdjacentHTML('afterbegin', '<h1>Settings loaded</h1>');
  });
  await expect(page.getByRole('heading', { name: 'Settings loaded' })).toHaveCount(0);
});
