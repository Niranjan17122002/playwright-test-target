import { test, expect } from '@playwright/test';

test('POSITIVE: Log in with valid credentials', async ({ page }) => {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });

  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) {
    throw new Error('APP_USERNAME and APP_PASSWORD must be set for the positive login test.');
  }

  await usernameInput.fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit').click();

  await page.waitForURL(url => url.pathname.endsWith('welcome.html'), { timeout: 15000 });
  await expect(page).toHaveURL(/welcome\.html$/);
});

test('NEGATIVE: Log in with invalid credentials', async ({ page }) => {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#username').fill('invalid_user');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  const message = page.locator('#login-message');
  await message.waitFor({ state: 'visible', timeout: 15000 });
  await expect(message).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});