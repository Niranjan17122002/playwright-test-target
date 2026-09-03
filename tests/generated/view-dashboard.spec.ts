import { test, expect } from '@playwright/test';

test.describe('View Dashboard', () => {
  test('POSITIVE: valid login navigates to Dashboard and confirms it loads', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();

    await page.waitForURL(url => url.pathname.endsWith('welcome.html'), { timeout: 15000 });

    await page.locator('#nav-dashboard').click();
    await page.waitForURL(url => url.pathname.endsWith('dashboard/index.html'), { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('#add-task-form')).toBeVisible();
    await expect(page.locator('#logout-link')).toBeVisible();
  });

  test('NEGATIVE: unauthenticated Dashboard access is blocked and redirected to Login', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.localStorage.removeItem('ttapp_logged_in');
      window.localStorage.removeItem('ttapp_role');
    });

    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.pathname.endsWith('login.html'), { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});