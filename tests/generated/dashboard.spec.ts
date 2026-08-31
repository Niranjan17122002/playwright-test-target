import { test, expect } from '@playwright/test';

test.describe('View dashboard after login', () => {
  test('POSITIVE: Valid credentials show the dashboard', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate to the login page
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    // Enter valid login credentials and submit
    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();

    // The login form redirects to welcome.html after a successful login.
    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

    // Navigate to the protected dashboard and confirm it renders (no redirect back to login).
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#task-list')).toBeVisible();
  });

  test('NEGATIVE: Invalid credentials show an error message', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill('invalid-user');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.', { timeout: 15000 });
    await expect(page).toHaveURL(/login\.html$/);
  });
});