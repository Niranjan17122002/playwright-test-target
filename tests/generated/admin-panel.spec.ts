import { test, expect } from '@playwright/test';

test('POSITIVE: Admin Panel loads for valid admin credentials', async ({ page }) => {
  test.setTimeout(120000);

  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) {
    throw new Error('APP_USERNAME and APP_PASSWORD must be set for the positive admin-panel scenario.');
  }

  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-admin').click();

  await page.locator('#login-form').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit').click();

  await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

  await page.locator('#link-admin').click();
  await page.waitForURL(url => url.toString().includes('admin.html'), { timeout: 15000 });

  await expect(page.locator('#admin-heading')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#admin-heading')).toHaveText('Admin Panel');
});

test('NEGATIVE: invalid credentials are rejected before Admin Panel access', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-admin').click();

  await page.locator('#login-form').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill('WrongUsername123!');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});
