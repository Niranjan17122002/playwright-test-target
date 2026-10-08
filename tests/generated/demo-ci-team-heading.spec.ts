import { test, expect } from '@playwright/test';
// DEMO ROW -- safe to delete (app documents GitHub CI demo)

test('POSITIVE: the Team page shows the invite section', async ({ page }) => {
  await page.goto('team/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Invite a new teammate');
});
