import { test, expect } from '@playwright/test';

function getBaseURL(): string {
  const fromEnv = process.env.BASE_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  // Prefer this Playwright project's configured baseURL (the address the
  // harness actually starts the server on), then fall back to localhost.
  // localhost resolves to both IPv4 and IPv6, unlike 127.0.0.1 which forced
  // the connection-refused IPv4-only address when the server bound elsewhere.
  return (test.info().project.use.baseURL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

test('POSITIVE: Log in with valid credentials and land on the welcome page', async ({ page }) => {
  test.setTimeout(120000);
  test.info().annotations.push({
    type: 'test-data',
    description: 'login: process.env.APP_USERNAME / process.env.APP_PASSWORD (this static app validates against its demo credentials, which must be supplied via env vars)',
  });

  const baseURL = getBaseURL();

  // 1. Open the login page
  await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' });

  // 2. Enter the login credentials
  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill(process.env.APP_USERNAME ?? '');

  const passwordInput = page.locator('#password');
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.fill(process.env.APP_PASSWORD ?? '');

  // 3. Submit the login form
  await page.locator('#login-submit').click();

  // 4. Wait for the redirect to welcome.html (the app navigates ~500ms after a successful login)
  await page.waitForURL((url) => url.toString().includes('welcome'), { timeout: 15000 });

  // 5. Verify the welcome page content
  const welcomeHeading = page.locator('#welcome-heading');
  await expect(welcomeHeading).toBeVisible();
  await expect(welcomeHeading).toHaveText('Welcome, demo!');
  await expect(page.locator('main').getByText('You are logged in.')).toBeVisible();
});

test('NEGATIVE: Invalid credentials show an error and stay on the login page', async ({ page }) => {
  const baseURL = getBaseURL();

  // 1. Open the login page
  await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' });

  // 2. Enter obviously-invalid credentials
  await page.locator('#username').fill('WrongUser');
  await page.locator('#password').fill('WrongPassword123!');

  // 3. Submit the login form
  await page.locator('#login-submit').click();

  // 4. Verify the error message is displayed and no redirect happened
  const loginMessage = page.locator('#login-message');
  await expect(loginMessage).toBeVisible();
  await expect(loginMessage).toHaveText('Invalid username or password.');
  await expect(loginMessage).toHaveClass(/error/);
  expect(page.url()).toContain('login.html');
});