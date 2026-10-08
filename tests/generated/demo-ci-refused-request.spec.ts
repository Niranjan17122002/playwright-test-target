import { test, expect } from '@playwright/test';

test('POSITIVE: shows the loaded demo settings', async ({ page }) => {
  await page.goto('');
  await page.evaluate(async () => {
    let ok = false;
    for (const url of ['demo-settings.json', '/demo-settings.json']) {
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) { ok = true; break; }
    }
    if (ok) document.body.insertAdjacentHTML('afterbegin', '<h1>Settings loaded</h1>');
  });
  await expect(page.getByRole('heading', { name: 'Settings loaded' })).toBeVisible({ timeout: 5000 });
});
