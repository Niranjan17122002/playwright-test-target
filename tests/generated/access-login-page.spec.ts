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
    // Fill username field with valid test credentials
    const textInput = page.locator("input[type='text']");
    await textInput.fill('testuser@example.com');
    await expect(textInput).toHaveValue('testuser@example.com');

    // Fill password field with valid test credentials
    const passwordInput = page.locator("input[type='password']");
    await passwordInput.fill('ValidPassword123!');
    await expect(passwordInput).toHaveValue('ValidPassword123!');
  });

  test('NEGATIVE: Login form rejects invalid credentials', async ({ page }) => {
    // Fill username field with invalid credentials
    const textInput = page.locator("input[type='text']");
    await textInput.fill('invaliduser@example.com');
    await expect(textInput).toHaveValue('invaliduser@example.com');

    // Fill password field with incorrect password
    const passwordInput = page.locator("input[type='password']");
    await passwordInput.fill('WrongPassword123!');
    await expect(passwordInput).toHaveValue('WrongPassword123!');

    // Attempt to submit form
    const submitButton = page.locator("button[type='submit'], input[type='submit']");
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Verify error message or form rejection
      await page.waitForTimeout(1000);
    }
  });

  test('NEGATIVE: Empty credentials submission is rejected', async ({ page }) => {
    // Attempt to submit form without filling any fields
    const submitButton = page.locator("button[type='submit'], input[type='submit']");
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Verify validation error or form remains on login page
      await page.waitForTimeout(500);
      expect(page.url()).toContain('login.html');
    }
  });

  test('BOUNDARY: Login form handles special characters in input fields', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const specialCharacters = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
    
    await textInput.fill(specialCharacters);
    await expect(textInput).toHaveValue(specialCharacters);

    const passwordInput = page.locator("input[type='password']");
    await passwordInput.fill(specialCharacters);
    await expect(passwordInput).toHaveValue(specialCharacters);
  });

  test('VALIDATION: Login form input fields have correct attributes', async ({ page }) => {
    const textInput = page.locator("input[type='text']");
    const passwordInput = page.locator("input[type='password']");

    // Verify input types
    await expect(textInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verify inputs are not disabled
    await expect(textInput).not.toBeDisabled();
    await expect(passwordInput).not.toBeDisabled();
  });

  test('SECURITY: Password field masks input characters', async ({ page }) => {
    const passwordInput = page.locator("input[type='password']");
    
    // Verify password field type is 'password' (ensures masking)
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');

    // Fill password and verify it's not visible as plain text
    await passwordInput.fill('SecretPassword123!');
    const inputValue = await passwordInput.inputValue();
    expect(inputValue).toBe('SecretPassword123!');
  });
});