import { test, expect } from '@playwright/test';

test.describe('Access the Admin Panel as an authenticated user', () => {
  test('POSITIVE: valid credentials open the Admin Panel', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('index.html', { waitUntil: 'domcontentloaded' });

    const loginNavLink = page.locator('#nav-login');
    await loginNavLink.waitFor({ state: 'visible', timeout: 15000 });
    await loginNavLink.click();

    await expect(page.locator('#login-form')).toBeVisible({ timeout: 15000 });

    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await passwordInput.fill(process.env.APP_PASSWORD ?? '');

    const loginUrl = page.url();
    await page.locator('#login-submit').click();
    await page.waitForURL(url => url.toString() !== loginUrl, { timeout: 15000 });

    await expect(page.locator('#welcome-heading')).toBeVisible({ timeout: 15000 });

    const adminLink = page.locator('#admin-link');
    await adminLink.waitFor({ state: 'visible', timeout: 15000 });
    await adminLink.click();

    await expect(page.locator('#admin-heading')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#admin-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#admin-user-count')).toBeVisible({ timeout: 15000 });
  });

  test('NEGATIVE: invalid credentials are rejected', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill('WrongUsername');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
    await expect(page).toHaveURL(/login\.html$/);
  });
});