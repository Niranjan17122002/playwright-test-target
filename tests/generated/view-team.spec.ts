import { test, expect } from '@playwright/test';

test.describe('Team page', () => {
  test('POSITIVE: View the Team page after logging in with valid credentials', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();

    await page.waitForURL(url => !url.toString().includes('login.html'), { timeout: 15000 });

    await page.goto('team/index.html', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible({ timeout: 15000 });
    const teamList = page.locator('#team-list');
    await expect(teamList).toBeVisible();
    await expect(teamList.locator('.list-item')).toHaveCount(4);
  });

  test('NEGATIVE: Login with invalid credentials shows an error and stays on the login page', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill('invalid_user');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
    await expect(page).toHaveURL(/login\.html$/);
  });
});