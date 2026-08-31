import { test, expect } from '@playwright/test';

test('POSITIVE: Log in with valid credentials', async ({ page }) => {
  test.setTimeout(120000);

  // Navigate to the Test Target App home page.
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#nav-login')).toBeVisible({ timeout: 15000 });

  // Open the login page via the stable nav id (the home page renders two Login links).
  await page.locator('#nav-login').click();
  await expect(page.locator('#login-form')).toBeVisible({ timeout: 15000 });

  const username = process.env.APP_USERNAME ?? '';
  const password = process.env.APP_PASSWORD ?? '';
  expect(username.length, 'APP_USERNAME env var must be set').toBeGreaterThan(0);
  expect(password.length, 'APP_PASSWORD env var must be set').toBeGreaterThan(0);

  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit').click();

  // Source shows a valid login redirects to welcome.html after a 500ms delay.
  await page.waitForURL(url => url.pathname.endsWith('welcome.html'), { timeout: 15000 });

  // Verify access to the auth-guarded Dashboard page.
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#task-list')).toBeVisible({ timeout: 15000 });
});

test('NEGATIVE: Log in with invalid credentials', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-login').click();
  await expect(page.locator('#login-form')).toBeVisible({ timeout: 15000 });

  await page.locator('#username').fill('WrongUsername');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  const message = page.locator('#login-message');
  await expect(message).toBeVisible({ timeout: 15000 });
  await expect(message).toHaveClass(/error/);
  await expect(message).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});