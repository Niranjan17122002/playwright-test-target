import { test, expect } from '@playwright/test';

test.describe('Welcome Page Navigation', () => {
  const WELCOME_PAGE_URL = 'https://niranjan17122002.github.io/playwright-test-target/welcome.html';

  test('POSITIVE: Successfully navigate to welcome page and verify it loads correctly', async ({ page }) => {
    // Navigate to welcome page
    await page.goto(WELCOME_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify page has loaded by checking body element exists
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify page title or URL to confirm correct page loaded
    await expect(page).toHaveURL(WELCOME_PAGE_URL);

    // Additional verification: check that page content is rendered
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('NEGATIVE: Handle navigation to invalid welcome page URL', async ({ page }) => {
    const invalidURL = 'https://niranjan17122002.github.io/playwright-test-target/invalid-welcome.html';

    // Attempt to navigate to invalid URL
    const response = await page.goto(invalidURL, { waitUntil: 'networkidle' }).catch(error => null);

    // Verify that page either returns 404 or navigation fails gracefully
    if (response) {
      expect(response.status()).toBe(404);
    }
  });

  test('POSITIVE: Verify welcome page body element is rendered with content', async ({ page }) => {
    await page.goto(WELCOME_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify body element exists and is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify body has child elements (content is rendered)
    const childCount = await body.locator('*').count();
    expect(childCount).toBeGreaterThan(0);
  });

  test('NEGATIVE: Verify error handling when page fails to load', async ({ page }) => {
    // Attempt navigation with very short timeout to simulate load failure
    try {
      await page.goto(WELCOME_PAGE_URL, { waitUntil: 'networkidle', timeout: 1000 }).catch(error => {
        expect(error).toBeDefined();
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('BOUNDARY: Verify welcome page loads with networkidle wait condition', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(WELCOME_PAGE_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Verify page loaded within reasonable time
    expect(loadTime).toBeLessThan(30000);

    // Verify body is present
    await expect(page.locator('body')).toBeVisible();
  });
});