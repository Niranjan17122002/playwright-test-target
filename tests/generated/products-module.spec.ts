import { test, expect } from '@playwright/test';

test.describe('Products module', () => {
  test('POSITIVE: Valid credentials let me log in and view the Products catalog', async ({ page }) => {
    test.setTimeout(120000);

    // Prerequisite: establish an authenticated session with valid credentials from env
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();
    await page.waitForURL((url) => url.toString().includes('welcome.html'), { timeout: 15000 });

    // Step 1: open the site home page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Step 2: click the 'Products' link in the site navigation (Modules grid)
    const productsLink = page.locator('#link-products');
    await productsLink.waitFor({ state: 'visible', timeout: 15000 });
    await productsLink.click();
    await page.waitForURL((url) => url.toString().includes('products.html'), { timeout: 15000 });

    // Step 3: verify the Products page loads with its product content
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    await expect(page.locator('#product-search')).toBeVisible();
    await expect(page.locator('#product-search')).toHaveAttribute('placeholder', 'e.g. Product 01');

    // Step 4: inspect the product items rendered in the table (10 rows on page 1)
    const rows = page.locator('#product-table-body tr');
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toHaveAttribute('data-name', 'Product 01');
    await expect(rows.first().locator('td')).toHaveCount(4);
    await expect(rows.first().locator('td').nth(2)).toHaveText(/^\$\d+\.\d{2}$/);

    // Inspect product actions: pagination controls and sortable columns
    await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 4');
    await expect(page.locator('#prev-page-btn')).toBeDisabled();
    await expect(page.locator('#next-page-btn')).toBeEnabled();
    await expect(page.locator('#sort-name')).toBeVisible();
    await expect(page.locator('#sort-price')).toBeVisible();
    await expect(page.locator('#sort-stock')).toBeVisible();
  });

  test('NEGATIVE: Invalid credentials are rejected at login', async ({ page }) => {
    // Short test: only the login-error check is needed
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill('WrongUser123');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('#login-submit').click();

    await expect(page.locator('#login-message')).toBeVisible();
    await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('BOUNDARY: Pagination limits and empty search state on the Products page', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate directly to the Products page
    await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

    // Lower boundary: first page, Previous disabled, Next enabled
    await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 4');
    await expect(page.locator('#prev-page-btn')).toBeDisabled();
    await expect(page.locator('#next-page-btn')).toBeEnabled();

    // Advance to the last page and verify the upper boundary
    await page.locator('#next-page-btn').click();
    await page.locator('#next-page-btn').click();
    await page.locator('#next-page-btn').click();
    await expect(page.locator('#page-indicator')).toHaveText('Page 4 of 4');
    await expect(page.locator('#next-page-btn')).toBeDisabled();
    await expect(page.locator('#prev-page-btn')).toBeEnabled();

    // Search with no matches shows the empty state
    await page.locator('#product-search').fill('zzz-no-such-product');
    await expect(page.locator('#product-empty-message')).toBeVisible();
    await expect(page.locator('#product-empty-message')).toHaveText('No products match your search.');
    await expect(page.locator('#product-table-body tr')).toHaveCount(0);
    await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 1');
  });
});