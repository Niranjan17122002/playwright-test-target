import { test, expect } from '@playwright/test';

test.describe('Log in with valid credentials', () => {
  test('POSITIVE: valid credentials log the user in and reach the authenticated area', async ({ page }) => {
    test.setTimeout(120000);

    const username = process.env.APP_USERNAME ?? '';
    const password = process.env.APP_PASSWORD ?? '';
    test.info().annotations.push({ type: 'test-data', description: 'username: supplied via APP_USERNAME env' });

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#login-submit').click();

    // Source redirects to welcome.html on success.
    await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });
    await expect(page.locator('#welcome-heading')).toContainText('Welcome', { timeout: 15000 });
    await expect(page.locator('#login-form')).toHaveCount(0);
  });

  test('NEGATIVE: invalid credentials are rejected and access is blocked', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(`wrong_user_${Date.now()}`);
    await page.locator('#password').fill('WrongPassword123!');

    const startingUrl = page.url();
    await page.locator('#login-submit').click();

    // Source sets this exact message on failure.
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.', { timeout: 15000 });
    // Stay on the login page, still showing the form.
    expect(page.url()).toBe(startingUrl);
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('VALIDATION: each required field blocks submission when left empty', async ({ page }) => {
    test.setTimeout(120000);

    // Confirmed required in source: <input name="username" required> and <input name="password" required>.
    const requiredFields = [
      { selector: '#username', label: 'Username', validValue: process.env.APP_USERNAME ?? 'demo' },
      { selector: '#password', label: 'Password', validValue: process.env.APP_PASSWORD ?? 'demo123' },
    ];

    for (const field of requiredFields) {
      await page.goto('login.html', { waitUntil: 'domcontentloaded' });

      const fieldLocator = page.locator(field.selector);
      await fieldLocator.waitFor({ state: 'visible', timeout: 15000 });

      // Fill every OTHER required field with a valid value so only this one is missing.
      for (const other of requiredFields) {
        if (other.selector !== field.selector) {
          await page.locator(other.selector).fill(other.validValue);
        }
      }
      await fieldLocator.fill('');

      await page.locator('#login-submit').click();

      // Native HTML `required` validation: the field reports a real validation message...
      const validationMessage = await fieldLocator.evaluate(
        (el) => (el as HTMLInputElement).validationMessage,
      );
      expect(validationMessage.length, `${field.label} should report a required-field validation message`).toBeGreaterThan(0);

      // ...and the form never actually submits (its own message element stays empty).
      await expect(page.locator('#login-message')).toHaveText('');
      expect(page.url()).toContain('login.html');
    }
  });

  test('BOUNDARY: an extremely long username is handled gracefully', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });

    const longUsername = 'a'.repeat(5000);
    await usernameInput.fill(longUsername);
    await page.locator('#password').fill('demo123');
    await page.locator('#login-submit').click();

    // Observed real behaviour: no crash, the app treats it as an unknown account.
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.', { timeout: 15000 });
    expect(page.url()).toContain('login.html');
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('SECURITY: an injected script string in the username field does not execute', async ({ page }) => {
    test.setTimeout(60000);

    let dialogFired = false;
    page.on('dialog', async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill('<script>alert(1)</script>');
    await page.locator('#password').fill('demo123');
    await page.locator('#login-submit').click();

    // The app writes the result with textContent, so nothing is injected or executed.
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.', { timeout: 15000 });
    expect(dialogFired, 'no script dialog should have fired').toBe(false);
    const injectedScriptNodes = await page
      .locator('#login-message')
      .evaluate((el) => el.querySelectorAll('script').length);
    expect(injectedScriptNodes).toBe(0);
  });

  test('BUTTON STATE: the submit button reflects reality before and after valid input', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('login.html', { waitUntil: 'domcontentloaded' });

    const submitButton = page.locator('#login-submit');
    await submitButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(submitButton).toHaveText('Log in');

    // Reality: the button has no disabled attribute, so it stays enabled even with empty fields
    // (native `required` validation is what blocks submission instead).
    await expect(submitButton).toBeEnabled();

    await page.locator('#username').fill(process.env.APP_USERNAME ?? 'demo');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? 'demo123');
    await expect(submitButton).toBeEnabled();
  });
});