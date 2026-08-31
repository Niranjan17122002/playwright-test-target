import { test, expect } from '@playwright/test';

test.describe('View profile details', () => {
  test('POSITIVE: Log in and view profile details', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const username = page.locator('#username');
    const password = page.locator('#password');
    const loginButton = page.locator('#login-submit');

    await username.waitFor({ state: 'visible', timeout: 15000 });
    await username.fill(process.env.APP_USERNAME ?? '');
    await password.fill(process.env.APP_PASSWORD ?? '');
    await loginButton.click();

    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

    await page.goto('profile.html', { waitUntil: 'domcontentloaded' });

    const profileHeading = page.getByRole('heading', { name: 'My Profile' });
    await profileHeading.waitFor({ state: 'visible', timeout: 15000 });

    const displayName = page.locator('#profile-display-name');
    const email = page.locator('#profile-email');

    await expect(displayName).toHaveValue(/\S+/);
    await expect(email).toHaveValue(/\S+/);
  });

  test('NEGATIVE: Log in with invalid credentials shows error', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const username = page.locator('#username');
    const password = page.locator('#password');
    const loginButton = page.locator('#login-submit');

    await username.waitFor({ state: 'visible', timeout: 15000 });
    await username.fill(`bad_user_${Date.now()}`);
    await password.fill('WrongPassword123!');
    await loginButton.click();

    const loginMessage = page.locator('#login-message');
    await expect(loginMessage).toHaveText('Invalid username or password.');
  });
});