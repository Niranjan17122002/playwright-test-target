import { test, expect } from '@playwright/test';

test('POSITIVE: valid credentials reach the Session Timeout page and show timeout behavior', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
  await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
  await page.locator('#login-submit').click();
  await page.waitForURL(url => !url.toString().includes('login.html'), { timeout: 15000 });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-session-timeout').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#link-session-timeout').click();
  await page.waitForURL(url => url.toString().includes('session-timeout.html'), { timeout: 15000 });

  await expect(page.locator('h1')).toHaveText('Session Timeout Demo');
  await expect(page.locator('main')).toContainText('This page simulates an idle session timeout');
  await expect(page.locator('#session-countdown')).toBeVisible();
  await expect(page.locator('#session-countdown')).toHaveText(/\d+/);
  await expect(page.locator('#extend-session-btn')).toBeVisible();
});

test('NEGATIVE: invalid credentials are rejected and cannot reach the Session Timeout page', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill('invalid-user-123');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();
  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');

  await page.goto('session-timeout.html', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(url => url.toString().includes('login.html'), { timeout: 15000 });
  await expect(page.locator('#login-form')).toBeVisible();
});