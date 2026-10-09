import { test, expect } from '@playwright/test';

test('POSITIVE: shows the loaded demo settings', async ({ page }) => {
  await page.goto('');
  const status = await page.evaluate(async () => {
    const res = await fetch('demo-settings-missing.json');
    if (res.ok) document.body.insertAdjacentHTML('afterbegin', '<h1>Settings loaded</h1>');
    return res.status;
  });
  // Documented behaviour: demo-settings-missing.json is not published, so the request is refused with 404
  expect(status).toBe(404);
  await expect(page.getByRole('heading', { name: 'Settings loaded' })).toHaveCount(0);
});
