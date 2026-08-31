import { test, expect } from '@playwright/test';

test('POSITIVE: Valid credentials then browse Products module displays product list', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill(process.env.APP_USERNAME ?? '');
  await page.locator('input[name="password"]').fill(process.env.APP_PASSWORD ?? '');
  await page.locator('#login-submit').click();

  await page.waitForURL(url => url.toString().includes('welcome.html'), { timeout: 15000 });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-products').click();
  await page.waitForURL(url => url.toString().includes('products.html'), { timeout: 15000 });

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await expect(page.locator('#product-table-body tr')).toHaveCount(10);
  await expect(page.locator('#product-table-body tr').first()).toContainText('Product 01');
});

test('NEGATIVE: Invalid credentials are rejected and stay on login', async ({ page }) => {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  await page.locator('input[name="username"]').fill('WrongUser123!');
  await page.locator('input[name="password"]').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});