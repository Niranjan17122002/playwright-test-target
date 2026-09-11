import { test, expect, Page } from '@playwright/test';

/**
 * Arrives at the Reset Password page with a VALID reset token.
 *
 * reset-password.html hides its own form and shows "invalid or expired" unless the
 * ?token= query parameter matches the token stored in localStorage by forgot-password.html.
 * So we run the real forgot-password flow first, then follow the generated reset link.
 */
async function arriveAtResetPage(page: Page): Promise<string> {
  const email = `test.${Date.now()}@example.com`;
  test.info().annotations.push({ type: 'test-data', description: `reset email: ${email}` });

  await page.goto('forgot-password.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#forgot-email').fill(email);
  await page.locator('#forgot-submit').click();

  // forgot-password.html renders a link to reset-password.html?token=<generated>.
  const resetLink = page.locator('#reset-link');
  await resetLink.waitFor({ state: 'visible', timeout: 15000 });
  await resetLink.click();

  // The form is only mounted/visible when the token is valid.
  await page.locator('#reset-new-password').waitFor({ state: 'visible', timeout: 15000 });
  return email;
}

test.describe('Reset password page', () => {

  test('POSITIVE: sets a new password with a valid reset token', async ({ page }) => {
    test.setTimeout(120000);

    await arriveAtResetPage(page);

    const newPassword = 'Passw0rd123';
    await page.locator('#reset-new-password').fill(newPassword);
    await page.locator('#reset-confirm-password').fill(newPassword);

    await page.locator('#reset-submit').click();

    const message = page.locator('#reset-message');
    await expect(message).toContainText('Your password has been reset.');
    await expect(message).toHaveClass(/success/);
    // User is directed back to the login page via the confirmation link.
    await expect(message.locator('a[href="login.html"]')).toBeVisible();
  });

  test('NEGATIVE: rejects submission when the two passwords do not match', async ({ page }) => {
    test.setTimeout(120000);

    await arriveAtResetPage(page);

    await page.locator('#reset-new-password').fill('Passw0rd123');
    await page.locator('#reset-confirm-password').fill('TotallyDifferent1');

    await page.locator('#reset-submit').click();

    const message = page.locator('#reset-message');
    await expect(message).toHaveText('Passwords do not match.');
    await expect(message).toHaveClass(/error/);
    await expect(message).not.toContainText('Your password has been reset.');
  });

  test('VALIDATION: each required password field blocks the submit on its own', async ({ page }) => {
    test.setTimeout(120000);

    await arriveAtResetPage(page);

    const fields = ['#reset-new-password', '#reset-confirm-password'];
    const validValue = 'Passw0rd123';

    for (const target of fields) {
      // Clear both fields, then fill every field EXCEPT the one under test.
      for (const f of fields) {
        await page.locator(f).fill('');
      }
      for (const f of fields) {
        if (f !== target) await page.locator(f).fill(validValue);
      }

      const field = page.locator(target);
      await expect(field).toHaveValue('');

      await page.locator('#reset-submit').click();

      // The native `required` attribute keeps this field invalid and blocks the submit.
      await expect(field).toHaveJSProperty('required', true);
      const isValid = await field.evaluate((el: HTMLInputElement) => el.checkValidity());
      expect(isValid).toBe(false);
      const validationMessage = await field.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage.length).toBeGreaterThan(0);

      // No success confirmation appears while a required field is empty.
      await expect(page.locator('#reset-message')).not.toContainText('Your password has been reset.');
    }
  });

  test('BOUNDARY: rejects a too-short password or one without a number', async ({ page }) => {
    test.setTimeout(120000);

    await arriveAtResetPage(page);

    // Primary action button is present and stays enabled (there is no JS disabling).
    const submit = page.locator('#reset-submit');
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();

    const invalidPasswords = [
      'abc123',   // 6 chars, contains a number -> fails the length rule
      'abcdefgh', // 8 chars, no number         -> fails the digit rule
    ];

    for (const pwd of invalidPasswords) {
      await page.locator('#reset-new-password').fill(pwd);
      await page.locator('#reset-confirm-password').fill(pwd);
      await submit.click();
      await expect(page.locator('#reset-message')).toHaveText(
        'Password must be at least 8 characters and include a number.'
      );
    }
  });

  test('SECURITY: reset form is blocked without a valid token', async ({ page }) => {
    // No token at all: the form must not be usable.
    await page.goto('reset-password.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#invalid-token-message')).toBeVisible();
    await expect(page.locator('#invalid-token-message')).toContainText('This reset link is invalid or has expired.');
    await expect(page.locator('#reset-form')).toBeHidden();

    // Bogus token that does not match any stored token: still blocked.
    await page.goto('reset-password.html?token=bogus-token-123', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#invalid-token-message')).toBeVisible();
    await expect(page.locator('#reset-form')).toBeHidden();
  });
});