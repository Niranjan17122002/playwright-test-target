import { test, expect } from '@playwright/test';

test('POSITIVE: Sign up with valid test data shows confirmation', async ({ page }) => {
  test.setTimeout(120000);

  const baseUsername = process.env.APP_USERNAME ?? '';
  expect(baseUsername).toBeTruthy();

  const username = `${baseUsername}_${Date.now()}`;
  const email = `test.${Date.now()}@example.com`;
  let password = process.env.APP_PASSWORD ?? '';
  while (password.length < 8) {
    password += 'Aa1!';
  }
  expect(password.length).toBeGreaterThanOrEqual(8);

  test.info().annotations.push({
    type: 'test-data',
    description: `username: ${username}; email: ${email}`,
  });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Sign Up' }).click();
  await expect(page.locator('h1')).toHaveText('Create an Account');

  await page.locator('input[name="fullname"]').fill('Test User');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirm-password"]').fill(password);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Account created. You can now log in.');
});

test('NEGATIVE: Sign up rejects mismatched passwords', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Sign Up' }).click();
  await expect(page.locator('h1')).toHaveText('Create an Account');

  await page.locator('input[name="fullname"]').fill('Negative Test User');
  await page.locator('input[name="username"]').fill(`negative_${Date.now()}`);
  await page.locator('input[name="email"]').fill(`negative.${Date.now()}@example.com`);
  await page.locator('input[name="password"]').fill('WrongPassword123!');
  await page.locator('input[name="confirm-password"]').fill('MismatchedPassword123!');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Passwords do not match.');
});

test('POSITIVE: Sign up with an optional referral code shows confirmation', async ({ page }) => {
  test.setTimeout(120000);

  const baseUsername = process.env.APP_USERNAME ?? '';
  expect(baseUsername).toBeTruthy();

  const username = `${baseUsername}_${Date.now()}`;
  const email = `test.${Date.now()}@example.com`;
  const referral = `REF-${Date.now()}`;
  let password = process.env.APP_PASSWORD ?? '';
  while (password.length < 8) {
    password += 'Aa1!';
  }
  expect(password.length).toBeGreaterThanOrEqual(8);

  test.info().annotations.push({
    type: 'test-data',
    description: `username: ${username}; email: ${email}; referral_code: ${referral}`,
  });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Sign Up' }).click();
  await expect(page.locator('h1')).toHaveText('Create an Account');

  await page.locator('input[name="fullname"]').fill('Referral Test User');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirm-password"]').fill(password);
  await page.locator('input[name="referral_code"]').fill(referral);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  const message = page.locator('#signup-message');
  await expect(message).toHaveText('Account created. You can now log in.');
});
