import { test, expect } from '@playwright/test';

test('POSITIVE: Authenticated admin can open the Admin Panel', async ({ page }) => {
  test.setTimeout(120000);

  // 1. Open the site home page
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 2. Click the 'Login' link in the site navigation
  const loginNav = page.locator('#nav-login');
  await loginNav.waitFor({ state: 'visible', timeout: 15000 });
  await loginNav.click();

  // 3. Enter the provided credentials into the login form
  await page.waitForURL((url) => url.toString().includes('login'), { timeout: 15000 });
  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill(process.env.APP_USERNAME ?? '');
  await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');

  // 4. Submit the login form (success redirects to welcome.html)
  await page.locator('#login-submit').click();
  await page.waitForURL((url) => url.toString().includes('welcome'), { timeout: 15000 });
  await expect(page.locator('#welcome-heading')).toBeVisible();

  // 5. Click the 'Admin Panel' link on the post-login welcome page
  const adminLink = page.locator('#admin-link');
  await adminLink.waitFor({ state: 'visible', timeout: 15000 });
  await adminLink.click();

  // 6. Verify the Admin Panel page loads with its admin content
  await page.waitForURL((url) => url.toString().includes('admin'), { timeout: 15000 });
  await expect(page.locator('#admin-heading')).toHaveText('Admin Panel');
  await expect(page.locator('#admin-content')).toContainText('Signed in as an administrator.');
  await expect(page.locator('#admin-content .tag').filter({ hasText: 'admin' })).toBeVisible();
  await expect(page.locator('#admin-user-count')).toBeVisible();
});

test('NEGATIVE: Invalid credentials are rejected and the user stays on the login page', async ({ page }) => {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });

  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill('WrongUser');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
  const loggedIn = await page.evaluate(() => localStorage.getItem('ttapp_logged_in'));
  expect(loggedIn).toBeNull();
});

test('SECURITY: Unauthenticated visit to the Admin Panel redirects to the login page', async ({ page }) => {
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

  await page.waitForURL((url) => url.toString().includes('login'), { timeout: 15000 });
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#admin-content')).toHaveCount(0);
});