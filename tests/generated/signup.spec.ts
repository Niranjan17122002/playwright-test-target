import { test, expect } from '@playwright/test';

test('POSITIVE: Create a new user account with valid details', async ({ page }) => {
  const username = `testuser_${Date.now()}`;
  const email = `test.${Date.now()}@example.com`;
  const password = `Passw0rd!${Date.now()}`;

  test.info().annotations.push({ type: 'test-data', description: `username: ${username}` });
  test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

  await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();

  await page.locator('#signup-fullname').fill('Automated Test User');
  await page.locator('#signup-username').fill(username);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-confirm-password').fill(password);
  await page.locator('#signup-submit').click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Account created. You can now log in.');
  await expect(message).toHaveClass(/success/);
  await expect(page.locator('#signup-fullname')).toHaveValue('');
});

test('NEGATIVE: Reject signup when password confirmation does not match', async ({ page }) => {
  const username = `testuser_${Date.now()}`;
  const email = `test.${Date.now()}@example.com`;

  test.info().annotations.push({ type: 'test-data', description: `username: ${username}` });
  test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

  await page.goto('signup.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();

  await page.locator('#signup-fullname').fill('Automated Test User');
  await page.locator('#signup-username').fill(username);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill('ValidPass123!');
  await page.locator('#signup-confirm-password').fill('DifferentPass123!');
  await page.locator('#signup-submit').click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Passwords do not match.');
  await expect(message).toHaveClass(/error/);
  await expect(page.locator('#signup-password')).toHaveValue('ValidPass123!');
});