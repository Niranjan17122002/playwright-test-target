import { test, expect } from '@playwright/test';

test.describe('Sign Up - Register a new account', () => {
  test('POSITIVE: Register a new account with valid details', async ({ page }) => {
    test.setTimeout(120000);

    const email = `test.${Date.now()}@example.com`;
    const fullName = `Test User ${Date.now()}`;
    const username = process.env.APP_USERNAME ?? 'testuser';
    const password = process.env.APP_PASSWORD ?? 'TestPassword123!';
    test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });
    test.info().annotations.push({ type: 'test-data', description: 'username/password come from APP_USERNAME/APP_PASSWORD env vars (fake fallbacks when unset)' });

    // 1. Open the site home page
    await page.goto('', { waitUntil: 'domcontentloaded' });

    // 2. Click the 'Sign Up' module card link to navigate to signup.html
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible({ timeout: 15000 });

    // 3. Fill the sign-up form with valid details
    await page.locator('#signup-fullname').fill(fullName);
    await page.locator('#signup-username').fill(username);
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill(password);
    await page.locator('#signup-confirm-password').fill(password);

    // 4. Submit the form
    await page.locator('#signup-submit').click();

    // 5. Verify the sign-up success state (success message shown and form resets, no redirect)
    await expect(page.locator('#signup-message')).toHaveText('Account created. You can now log in.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/success/);
    await expect(page.locator('#signup-username')).toHaveValue('');
  });

  test('NEGATIVE: Reject registration when passwords do not match', async ({ page }) => {
    test.setTimeout(120000);

    const email = `test.${Date.now()}@example.com`;
    const fullName = `Test User ${Date.now()}`;
    test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

    await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible({ timeout: 15000 });

    await page.locator('#signup-fullname').fill(fullName);
    await page.locator('#signup-username').fill(`mismatch${Date.now()}`);
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill('WrongPassword123!');
    await page.locator('#signup-confirm-password').fill('DifferentPassword456!');
    await page.locator('#signup-submit').click();

    await expect(page.locator('#signup-message')).toHaveText('Passwords do not match.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/error/);
  });

  test('VALIDATION: Reject an invalid email address format', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible({ timeout: 15000 });

    await page.locator('#signup-fullname').fill(`Test User ${Date.now()}`);
    await page.locator('#signup-username').fill(`invalidemail${Date.now()}`);
    await page.locator('#signup-email').fill('not-an-email');
    await page.locator('#signup-password').fill('TestPassword123!');
    await page.locator('#signup-confirm-password').fill('TestPassword123!');
    await page.locator('#signup-submit').click();

    await expect(page.locator('#signup-message')).toHaveText('Enter a valid email address.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/error/);
  });

  test('BOUNDARY: Enforce minimum password length of 8 characters', async ({ page }) => {
    test.setTimeout(120000);

    const email = `test.${Date.now()}@example.com`;
    const username = `boundary${Date.now()}`;
    test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

    await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible({ timeout: 15000 });

    await page.locator('#signup-fullname').fill('Test User');
    await page.locator('#signup-username').fill(username);
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill('Short7!');
    await page.locator('#signup-confirm-password').fill('Short7!');
    await page.locator('#signup-submit').click();

    await expect(page.locator('#signup-message')).toHaveText('Password must be at least 8 characters.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/error/);

    // Resubmit with a valid 8+ character password
    await page.locator('#signup-password').fill('LongEnough1!');
    await page.locator('#signup-confirm-password').fill('LongEnough1!');
    await page.locator('#signup-submit').click();

    await expect(page.locator('#signup-message')).toHaveText('Account created. You can now log in.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/success/);
  });

  test('SECURITY: Reject a reserved username', async ({ page }) => {
    test.setTimeout(120000);

    const email = `test.${Date.now()}@example.com`;
    test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

    await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible({ timeout: 15000 });

    await page.locator('#signup-fullname').fill('Test User');
    await page.locator('#signup-username').fill('admin');
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill('TestPassword123!');
    await page.locator('#signup-confirm-password').fill('TestPassword123!');
    await page.locator('#signup-submit').click();

    await expect(page.locator('#signup-message')).toHaveText('That username is already taken.', { timeout: 15000 });
    await expect(page.locator('#signup-message')).toHaveClass(/error/);
  });
});