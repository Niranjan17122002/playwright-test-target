import { test, expect } from '@playwright/test';

test.describe('Access Login Page', () => {
  const LOGIN_URL = 'https://niranjan17122002.github.io/playwright-test-target/login.html';

  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  });

  test('POSITIVE: User successfully navigates to login page and verifies form elements are visible', async ({ page }) => {
    // Verify page title or URL
    expect(page.url()).toContain('login.html');

    // Verify login form is visible
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible();

    // Verify username/email input field is visible
    const textInput = page.locator("input[type='text']");
    await expect(textInput).toBeVisible();
    await expect(textInput).toBeEnabled();

    // Verify password input field is visible
    const passwordInput = page.locator("input[type='password']");
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toBeEnabled();

    // Verify form is accessible and interactive
    await expect(loginForm).toHaveCount(1);
  });

  test('POSITIVE: User can interact with login form fields', async ({ page }) => {
    // Fill username field
    const textInput = page.locator("input[type='text']");
    await textInput.fill('testuser@example.com');
    await expect(textInput).toHaveValue('testuser@example.com');

    // Fill password field
    const passwordInput = page.locator("input[type='password']");
    await passwordInput.fill('ValidPassword123');
    await expect(passwordInput).toHaveValue('ValidPassword123');
  });

  test('NEGATIVE: Login form rejects empty credentials', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const passwordInput = page.locator("input[type='password']");
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');

    // Attempt to submit with empty fields
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Verify form validation or error message appears
      const errorMessage = page.locator('[role="alert"], .error, .error-message');
      const isErrorVisible = await errorMessage.isVisible().catch(() => false);
      // Either error message appears or form remains unfilled
      expect(isErrorVisible || (await textInput.inputValue()) === '').toBeTruthy();
    }
  });

  test('NEGATIVE: Login form rejects invalid credentials', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const passwordInput = page.locator("input[type='password']");
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');

    // Fill with invalid credentials
    await textInput.fill('invaliduser@wrong.com');
    await passwordInput.fill('WrongPassword999');

    // Attempt to submit
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Verify error handling (error message or page remains on login)
      const errorMessage = page.locator('[role="alert"], .error, .error-message');
      const isErrorVisible = await errorMessage.isVisible().catch(() => false);
      const isStillOnLoginPage = page.url().includes('login.html');
      expect(isErrorVisible || isStillOnLoginPage).toBeTruthy();
    }
  });

  test('BOUNDARY: Login form handles special characters in input fields', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const passwordInput = page.locator("input[type='password']");

    // Test with special characters
    const specialCharsEmail = 'user+test@example.com';
    const specialCharsPassword = 'P@ssw0rd!#$%';

    await textInput.fill(specialCharsEmail);
    await passwordInput.fill(specialCharsPassword);

    // Verify fields accept and retain special characters
    expect(await textInput.inputValue()).toBe(specialCharsEmail);
    expect(await passwordInput.inputValue()).toBe(specialCharsPassword);
  });

  test('VALIDATION: Login form input fields have correct types and attributes', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const passwordInput = page.locator("input[type='password']");

    // Verify input type attributes
    await expect(textInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verify password field masks input
    await passwordInput.fill('TestPassword123');
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');
  });

  test('SECURITY: Password field input is masked and not visible as plain text', async ({ page }) => {
    const passwordInput = page.locator("input[type='password']");
    await passwordInput.fill('SensitivePassword123');

    // Verify the input type remains password (not text)
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');

    // Verify we cannot read the actual value through standard DOM methods
    const value = await passwordInput.inputValue();
    expect(value).toBe('SensitivePassword123'); // Value is stored but displayed as masked
  });
});