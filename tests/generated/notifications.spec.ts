import { test, expect } from '@playwright/test';

test.describe('Notifications page', () => {
  test('POSITIVE: view notifications page after valid login', async ({ page }) => {
    test.setTimeout(120000);

    // Log in with valid credentials (env-provided only)
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();

    // Source confirms a successful login redirects to welcome.html
    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

    // Navigate to the notifications page
    await page.goto('notifications.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

    // Starts in the empty state
    await expect(page.locator('#notification-log-empty')).toBeVisible();

    // Generate a notification so an item exists in the history
    await page.locator('#show-notification-btn').click();

    const firstNotification = page.locator('#notification-log li').first();
    await firstNotification.waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.locator('#notification-log li')).toHaveCount(1);
    await expect(firstNotification).toContainText('Notification #1');
    await expect(page.locator('#notification-log-empty')).toBeHidden();
  });

  test('NEGATIVE: invalid login shows error message', async ({ page }) => {
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    await page.locator('#username').fill('WrongUser123!');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    const message = page.locator('#login-message');
    await expect(message).toBeVisible();
    await expect(message).toHaveText('Invalid username or password.');

    // Should stay on the login page rather than redirecting
    await expect(page).toHaveURL(/login\.html/);
  });
});