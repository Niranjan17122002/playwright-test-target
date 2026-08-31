import { test, expect } from '@playwright/test';

test.describe('Profile page', () => {
  test('POSITIVE: View the Profile page with valid credentials', async ({ page }) => {
    test.setTimeout(120000);

    // Log in as a valid user so the protected Profile page can be reached.
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();
    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

    // Journey: navigate home and open the Profile module.
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#link-profile').click();
    await page.waitForURL(url => url.toString().includes('profile.html'), { timeout: 15000 });

    const profileHeading = page.getByRole('heading', { name: 'My Profile' });
    await expect(profileHeading).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#profile-display-name')).toHaveValue('Demo User');
    await expect(page.locator('#profile-email')).toHaveValue('demo@example.com');
  });

  test('NEGATIVE: Invalid credentials cannot access the Profile page', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill('not-a-real-user');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');

    // The protected Profile page should redirect back to Login for an unauthenticated visitor.
    await page.goto('profile.html', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.toString().includes('login.html'), { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible();
  });
});