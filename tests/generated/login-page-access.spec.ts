import { test, expect } from '@playwright/test';

test.describe('Login Page Access', () => {
  const LOGIN_URL = 'https://niranjan17122002.github.io/playwright-test-target/login.html';

  test('POSITIVE: Navigate to login page and verify form elements load correctly', async ({ page }) => {
    // Navigate to login page
    await page.goto(LOGIN_URL);

    // Verify page title or heading
    await expect(page).toHaveTitle(/login|sign in/i);

    // Verify login form exists
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible();

    // Verify username/email input field exists
    const usernameInput = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]').first();
    await expect(usernameInput).toBeVisible();

    // Verify password input field exists
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Verify submit button exists
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await expect(submitButton).toBeVisible();

    // Verify form is interactive
    await expect(usernameInput).toBeEnabled();
    await expect(passwordInput).toBeEnabled();
    await expect(submitButton).toBeEnabled();
  });

  test('NEGATIVE: Attempt login with invalid credentials and verify error handling', async ({ page }) => {
    // Navigate to login page
    await page.goto(LOGIN_URL);

    // Verify page loaded
    await expect(page).toHaveTitle(/login|sign in/i);

    // Fill form with invalid credentials
    const usernameInput = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');

    await usernameInput.fill('invalid_user_12345@test.com');
    await passwordInput.fill('wrongpassword123');

    // Submit form
    await submitButton.click();

    // Wait for response and verify error handling
    await page.waitForTimeout(2000);

    // Verify either error message appears or user remains on login page
    const errorMessage = page.locator('[class*="error"], [class*="alert"], [role="alert"]');
    const isErrorVisible = await errorMessage.isVisible().catch(() => false);
    const isStillOnLoginPage = page.url().includes('login');

    // At least one of these conditions should be true
    expect(isErrorVisible || isStillOnLoginPage).toBeTruthy();
  });

  test('VALIDATION: Verify all required form fields are present and labeled', async ({ page }) => {
    await page.goto(LOGIN_URL);

    // Check for form labels
    const labels = page.locator('label');
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThanOrEqual(2);

    // Verify input fields have proper attributes
    const usernameInput = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"]');

    // Check for placeholder or aria-label
    const usernameHasLabel = await usernameInput.getAttribute('placeholder').catch(() => null) ||
                             await usernameInput.getAttribute('aria-label').catch(() => null);
    const passwordHasLabel = await passwordInput.getAttribute('placeholder').catch(() => null) ||
                            await passwordInput.getAttribute('aria-label').catch(() => null);

    expect(usernameHasLabel || labelCount > 0).toBeTruthy();
    expect(passwordHasLabel || labelCount > 0).toBeTruthy();
  });

  test('BOUNDARY: Verify form handles empty submission attempt', async ({ page }) => {
    await page.goto(LOGIN_URL);

    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await submitButton.click();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify either validation error or form remains on page
    const validationError = page.locator('[class*="error"], [class*="invalid"], [role="alert"]');
    const isErrorVisible = await validationError.isVisible().catch(() => false);
    const isStillOnLoginPage = page.url().includes('login');

    expect(isErrorVisible || isStillOnLoginPage).toBeTruthy();
  });

  test('SECURITY: Verify password field masks input', async ({ page }) => {
    await page.goto(LOGIN_URL);

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verify input is masked
    await passwordInput.fill('testpassword123');
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');
  });
});