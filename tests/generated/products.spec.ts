import { test, expect, type Page } from '@playwright/test';

/**
 * Journey: View the Products module
 *  1. Open the site home page
 *  2. Click the 'Products' link in the site navigation
 *  3. Verify the Products page loads with its product content
 *  4. Inspect any product items or product actions displayed on the page
 *
 * The Products catalog is reached through the authenticated module area, so
 * the positive flow logs in with valid credentials (from env) before opening
 * the catalog; the negative flow proves invalid credentials are rejected at
 * the login gate and never reach the module.
 */

async function logIn(page: Page, username: string, password: string): Promise<void> {
  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-submit').click();
}

test('POSITIVE: Valid credentials grant access to the Products catalog', async ({ page }) => {
  test.setTimeout(120000);

  // Log in with valid credentials (real secrets come from the environment)
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  await logIn(page, process.env.APP_USERNAME ?? '', process.env.APP_PASSWORD ?? '');

  // Successful login redirects to welcome.html (concrete signal, not a guess)
  await page.waitForURL(url => url.toString().includes('welcome'), { timeout: 15000 });
  await expect(page.getByText('You are logged in.')).toBeVisible();

  // Step 1: Open the site home page
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Welcome', level: 1 })).toBeVisible();

  // Step 2: Click the 'Products' link in the site navigation (module card)
  await page.locator('#link-products').click();

  // Step 3: Verify the Products page loads with its product content
  await expect(page).toHaveURL(/products\.html/);
  await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
  await expect(page.locator('#product-search')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();

  // Step 4: Inspect product items rendered on the page
  const rows = page.locator('#product-table-body tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Product 01');
  await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 4');
  await expect(page.locator('#prev-page-btn')).toBeDisabled();
  await expect(page.locator('#next-page-btn')).toBeEnabled();

  // Inspect product actions: search narrows the catalog
  await page.locator('#product-search').fill('Product 01');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 1');

  // Restore the list and page forward to confirm pagination works
  await page.locator('#product-search').fill('');
  await expect(rows).toHaveCount(10);
  await page.locator('#next-page-btn').click();
  await expect(page.locator('#page-indicator')).toHaveText('Page 2 of 4');
  await expect(page.locator('#prev-page-btn')).toBeEnabled();
  await expect(rows.first()).toContainText('Product 11');
});

test('NEGATIVE: Invalid credentials are rejected and access is denied', async ({ page }) => {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  // Obviously-fake literal credentials (safe to commit)
  await logIn(page, 'WrongUsername_NotARealUser', 'WrongPassword123!');

  // Invalid credentials must surface the real error message and error styling
  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page.locator('#login-message')).toHaveClass(/error/);

  // No redirect occurs even after the redirect window has passed
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible();
});