import { test, expect } from '@playwright/test';

test('POSITIVE: valid account email requests reset and new password is accepted', async ({ page }) => {
  test.setTimeout(120000);

  const email = process.env.APP_USERNAME ?? `test.${Date.now()}@example.com`;
  const newPassword = `Reset${Date.now()}${process.env.APP_PASSWORD ?? 'a1'}`;
  test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });
  test.info().annotations.push({ type: 'test-data', description: `new-password: ${newPassword}` });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-forgot-password').click();
  await page.waitForURL(url => url.pathname.endsWith('forgot-password.html'));
  await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();

  await page.locator('#forgot-email').fill(email);
  await page.locator('#forgot-submit').click();

  const resetLink = page.locator('#reset-link');
  await expect(resetLink).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#forgot-message')).toContainText('If an account exists for that email');
  await resetLink.click();

  await page.waitForURL(url => url.pathname.endsWith('reset-password.html'));
  await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();

  await page.locator('#reset-new-password').fill(newPassword);
  await page.locator('#reset-confirm-password').fill(newPassword);
  await page.locator('#reset-submit').click();

  await expect(page.locator('#reset-message')).toContainText('Your password has been reset.');
  await expect(page.locator('#reset-message')).toHaveClass('message success');
});

test('NEGATIVE: invalid account email is rejected on Forgot Password', async ({ page }) => {
  await page.goto('forgot-password.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();

  await page.locator('#forgot-email').fill('not-an-email');
  await page.locator('#forgot-submit').click();

  await expect(page.locator('#forgot-message')).toHaveText('');
  await expect(page.locator('#reset-link')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();
});