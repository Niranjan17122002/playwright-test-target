import { test, expect } from '@playwright/test';

test('POSITIVE: Admin Panel loads for valid admin credentials', async ({ page }) => {
  test.setTimeout(120000);

  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) {
    throw new Error('APP_USERNAME and APP_PASSWORD must be set for the positive admin-panel scenario.');
  }

  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-admin').click({ noWaitAfter: true });

  await page.locator('#login-form').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit').click({ noWaitAfter: true });

  await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

  await page.locator('#admin-link').click({ noWaitAfter: true });
  await page.waitForURL(url => url.toString().includes('admin.html'), { timeout: 15000 });

  const adminHeading = page.locator('h1, h2, h3').filter({ hasText: /Admin Dashboard|Administrator Dashboard|Admin Panel/i }).first();
  await expect(adminHeading).toBeVisible({ timeout: 15000 });
  await expect(adminHeading).toContainText(/Admin Dashboard|Administrator Dashboard|Admin Panel/i);
});

test('NEGATIVE: invalid credentials are rejected before Admin Panel access', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-admin').click();

  await page.locator('#login-form').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill('WrongUsername123!');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});
