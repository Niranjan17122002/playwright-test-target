import { test, expect } from '@playwright/test';

test.describe('Admin Panel access journey', () => {
  test('POSITIVE: Access the Admin Panel with valid credentials', async ({ page }) => {
    test.setTimeout(120000);

    // Open the site home page
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nav-home')).toBeVisible();

    // Click the 'Login' link in the site navigation (unique id on the home page nav)
    await page.locator('#nav-login').click();

    // Enter the provided credentials into the login form
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(process.env.APP_USERNAME ?? '');
    await passwordInput.fill(process.env.APP_PASSWORD ?? '');

    // Submit the login form
    await page.locator('#login-submit').click();

    // login.html redirects to welcome.html (500ms) on a valid login
    await page.waitForURL('**/welcome.html', { timeout: 15000 });
    await expect(page.locator('#welcome-heading')).toBeVisible();

    // Click the 'Admin Panel' link in the navigation (welcome page -> admin.html)
    await page.locator('#admin-link').click();

    // Verify the Admin Panel page loads with its admin content
    await expect(page.locator('#admin-heading')).toBeVisible();
    await expect(page.locator('#admin-heading')).toHaveText('Admin Panel');
    await expect(page.locator('#admin-content')).toContainText('Signed in as an administrator.');
    await expect(page.locator('#admin-user-count')).toBeVisible();
  });

  test('NEGATIVE: Invalid credentials are rejected on the login form', async ({ page }) => {
    // Go straight to the login page
    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });

    // Obviously-fake credentials
    await usernameInput.fill('wronguser');
    await passwordInput.fill('WrongPassword123!');

    // Submit the login form
    await page.locator('#login-submit').click();

    // Error message is shown and the user stays on the login page (no redirect)
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
    await expect(page).toHaveURL(/login\.html$/);
  });
});