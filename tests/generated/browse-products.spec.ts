import { test, expect } from '@playwright/test';

test.describe('Browse products', () => {
  test('POSITIVE: product catalog renders with paginated rows', async ({ page }) => {
    await page.goto('products.html', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();

    const productRows = page.locator('#product-table-body tr');
    await expect(productRows).toHaveCount(10);
    await expect(productRows.first().locator('td').first()).toHaveText('Product 01');
    await expect(page.locator('#page-indicator')).toHaveText('Page 1 of 4');
  });

  test('NEGATIVE: search with no matches shows empty message', async ({ page }) => {
    await page.goto('products.html', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('#product-search');
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill('zzzz-no-match');

    await expect(page.locator('#product-empty-message')).toBeVisible();
    await expect(page.locator('#product-empty-message')).toHaveText('No products match your search.');
    await expect(page.locator('#product-table-body tr')).toHaveCount(0);
  });
});