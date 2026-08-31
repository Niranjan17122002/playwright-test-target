import { test, expect } from '@playwright/test';

test('POSITIVE: Register a new account with valid credentials', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('link', { name: 'Sign Up' }).click();
  await page.waitForURL((url) => url.toString().includes('signup'), { timeout: 15000 });

  await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();

  const username = process.env.APP_USERNAME ?? `signup_${Date.now()}`;
  const password = process.env.APP_PASSWORD ?? `Passw0rd!${Date.now()}`;
  const email = `signup.${Date.now()}@example.com`;
  test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });
  test.info().annotations.push({ type: 'test-data', description: `username: ${username}` });

  await page.locator('#signup-fullname').fill(`Test User ${Date.now()}`);
  await page.locator('#signup-username').fill(username);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-confirm-password').fill(password);

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('Account created. You can now log in.');

  const stored = await page.evaluate(() => localStorage.getItem('ttapp_registered_users') || '[]');
  const users = JSON.parse(stored) as Array<{ username: string }>;
  expect(users.some((u) => u.username === username)).toBeTruthy();
});

test('NEGATIVE: Sign up is rejected when passwords do not match', async ({ page }) => {
  await page.goto('/signup.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#signup-fullname').fill('Mismatch Test');
  await page.locator('#signup-username').fill(`mismatch_${Date.now()}`);
  await page.locator('#signup-email').fill(`mismatch.${Date.now()}@example.com`);
  await page.locator('#signup-password').fill('WrongPassword123!');
  await page.locator('#signup-confirm-password').fill('DifferentPassword123!');

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('Passwords do not match.');
});

test('VALIDATION: Sign up is rejected with an invalid email address', async ({ page }) => {
  await page.goto('/signup.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#signup-fullname').fill('Bad Email Test');
  await page.locator('#signup-username').fill(`bad_email_${Date.now()}`);
  await page.locator('#signup-email').fill('not-an-email');
  await page.locator('#signup-password').fill('ValidPassw0rd!');
  await page.locator('#signup-confirm-password').fill('ValidPassw0rd!');

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('Enter a valid email address.');
});

test('VALIDATION: Sign up is rejected when the password is shorter than 8 characters', async ({ page }) => {
  await page.goto('/signup.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#signup-fullname').fill('Short Password Test');
  await page.locator('#signup-username').fill(`short_pw_${Date.now()}`);
  await page.locator('#signup-email').fill(`shortpw.${Date.now()}@example.com`);
  await page.locator('#signup-password').fill('short');
  await page.locator('#signup-confirm-password').fill('short');

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('Password must be at least 8 characters.');
});

test('BOUNDARY: Submitting an empty sign-up form shows the required-fields error', async ({ page }) => {
  await page.goto('/signup.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('All fields are required.');
});

test('SECURITY: Registering a reserved username is blocked', async ({ page }) => {
  await page.goto('/signup.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#signup-fullname').fill('Reserved Name Test');
  await page.locator('#signup-username').fill('admin');
  await page.locator('#signup-email').fill(`reserved.${Date.now()}@example.com`);
  await page.locator('#signup-password').fill('ValidPassw0rd!');
  await page.locator('#signup-confirm-password').fill('ValidPassw0rd!');

  await page.locator('#signup-submit').click();

  await expect(page.locator('#signup-message')).toHaveText('That username is already taken.');
});