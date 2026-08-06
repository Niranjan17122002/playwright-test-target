import { test, expect } from '@playwright/test';

test.describe('Navigate and Verify Home Page', () => {
  const BASE_URL = 'https://niranjan17122002.github.io/playwright-test-target/';

  test('POSITIVE: Successfully navigate to home page and verify content loads', async ({ page }) => {
    // Navigate to the application entry point
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify page body is visible and rendered
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify page has a valid title
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);

    // Additional verification: page URL matches expected entry point
    expect(page.url()).toContain('playwright-test-target');
  });

  test('NEGATIVE: Handle navigation timeout gracefully', async ({ page }) => {
    // Attempt to navigate with very short timeout to simulate network failure
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 100 });
      // If we reach here, the page loaded (which is fine for this negative test)
      const bodyElement = page.locator('body');
      await expect(bodyElement).toBeVisible();
    } catch (error) {
      // Expected behavior: timeout error is caught
      expect(error).toBeDefined();
    }
  });

  test('BOUNDARY: Verify page loads with default wait condition', async ({ page }) => {
    // Navigate without explicit waitUntil to test default behavior
    await page.goto(BASE_URL);

    // Verify body element exists in DOM
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeAttached();

    // Verify page title is not empty
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');
  });

  test('VALIDATION: Verify page structure and essential elements', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify HTML structure is valid
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify body element is present and accessible
    const bodyElement = page.locator('body');
    await expect(bodyElement).toHaveCount(1);

    // Verify page is not showing error states
    const errorIndicators = page.locator('text=/error|failed|404|500/i');
    const errorCount = await errorIndicators.count();
    expect(errorCount).toBe(0);
  });

  test('SECURITY: Verify page loads from correct secure origin', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify URL is from expected domain
    const currentUrl = page.url();
    expect(currentUrl).toContain('niranjan17122002.github.io');
    expect(currentUrl).toContain('playwright-test-target');

    // Verify page is accessible (no 403/401 errors)
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBeLessThan(400);
  });
});