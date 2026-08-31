import { test, expect } from '@playwright/test';

test.describe('View the Dashboard', () => {
  test('POSITIVE: View Dashboard with valid credentials', async ({ page }) => {
    test.setTimeout(120000);

    const username = process.env.APP_USERNAME ?? '';
    const password = process.env.APP_PASSWORD ?? '';

    expect(username, 'APP_USERNAME must be set to a valid user for this test').not.toBe('');
    expect(password, 'APP_PASSWORD must be set to a valid password for this test').not.toBe('');

    // Dashboard requires an authenticated session, so log in first.
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#login-submit').click();
    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

    // Journey step: navigate to the home page.
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });

    // Journey step: click the Dashboard nav link.
    await page.locator('#nav-dashboard').click();

    // Journey step: confirm the dashboard content loads.
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('#task-list')).toBeVisible();
    await expect(page.locator('#task-list .list-item').first()).toContainText("Publish next week's shifts");
  });

  test('NEGATIVE: Invalid credentials cannot access Dashboard', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#username').fill('WrongUsername');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    const message = page.locator('#login-message');
    await expect(message).toHaveText('Invalid username or password.', { timeout: 15000 });

    // Dashboard must remain protected without a valid session.
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.toString().includes('login.html'), { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});