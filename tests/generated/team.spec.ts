import { test, expect } from '@playwright/test';

test.describe('Team page', () => {
  test('POSITIVE: View team members page after valid login', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();

    await page.waitForURL(url => !url.toString().includes('login'), { timeout: 15000 });

    await page.goto('team/index.html', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    const rosterItems = page.locator('#team-list .list-item');
    await expect(rosterItems).toHaveCount(4);
    await expect(rosterItems.first()).toContainText('Priya Nair');
  });

  test('NEGATIVE: Invalid login credentials show an error', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const invalidUsername = `invalid_user_${Date.now()}`;
    test.info().annotations.push({ type: 'test-data', description: `username: ${invalidUsername}` });

    await page.locator('#username').fill(invalidUsername);
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
    await expect(page).toHaveURL(/login\.html/);
  });
});