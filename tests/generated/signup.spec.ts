import { test, expect } from '@playwright/test';

test('POSITIVE: Sign up with valid test data shows confirmation', async ({ page }) => {
  test.setTimeout(120000);

  const baseUsername = process.env.APP_USERNAME ?? '';
  expect(baseUsername).toBeTruthy();

  const username = `${baseUsername}_${Date.now()}`;
  const email = `test.${Date.now()}@example.com`;
  const password = process.env.APP_PASSWORD ?? '';
  expect(password.length).toBeGreaterThanOrEqual(8);

  test.info().annotations.push({
    type: 'test-data',
    description: `username: ${username}; email: ${email}`,
  });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-signup').click();
  await expect(page.locator('h1')).toHaveText('Create an Account');

  await page.locator('#signup-fullname').fill('Test User');
  await page.locator('#signup-username').fill(username);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-confirm-password').fill(password);
  await page.locator('#signup-submit').click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Account created. You can now log in.');
  await expect(message).toHaveClass('message success');
});

test('NEGATIVE: Sign up rejects mismatched passwords', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-signup').click();
  await expect(page.locator('h1')).toHaveText('Create an Account');

  await page.locator('#signup-fullname').fill('Negative Test User');
  await page.locator('#signup-username').fill(`negative_${Date.now()}`);
  await page.locator('#signup-email').fill(`negative.${Date.now()}@example.com`);
  await page.locator('#signup-password').fill('WrongPassword123!');
  await page.locator('#signup-confirm-password').fill('MismatchedPassword123!');
  await page.locator('#signup-submit').click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Passwords do not match.');
  await expect(message).toHaveClass('message error');
});