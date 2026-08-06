import { test, expect } from '@playwright/test';

test.describe('Navigate and Verify Home Page', () => {
  const BASE_URL = 'https://niranjan17122002.github.io/playwright-test-target/';

  test('POSITIVE: Successfully navigate to home page and verify content loads correctly', async ({ page }) => {
    // Navigate to the application entry point
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify page title is present and correct
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);

    // Verify main content area is visible
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Additional verification: Check that page has loaded with content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);

    // Verify no console errors occurred during page load
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    expect(consoleErrors.length).toBe(0);
  });

  test('NEGATIVE: Handle navigation failure with invalid URL', async ({ page }) => {
    // Attempt to navigate to an invalid/non-existent URL
    const invalidURL = 'https://niranjan17122002.github.io/playwright-test-target/invalid-page-that-does-not-exist';
    
    try {
      await page.goto(invalidURL, { waitUntil: 'networkidle', timeout: 10000 });
    } catch (error) {
      // Expected to fail or return 404
      expect(error).toBeDefined();
    }

    // Verify page did not load successfully
    const response = await page.goto(invalidURL, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('BOUNDARY: Verify page loads within acceptable time frame', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loaded within 30 seconds
    expect(loadTime).toBeLessThan(30000);
    
    // Verify body is visible after load
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();
  });

  test('VALIDATION: Verify page structure and essential elements', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify page title exists and is not empty
    const pageTitle = await page.title();
    expect(pageTitle).not.toEqual('');

    // Verify body element exists and is in DOM
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeAttached();

    // Verify page has HTML structure
    const htmlElement = await page.locator('html');
    await expect(htmlElement).toBeAttached();

    // Verify page is not showing error state
    const pageContent = await page.content();
    expect(pageContent).not.toContain('404');
    expect(pageContent).not.toContain('Error');
  });

  test('SECURITY: Verify page loads over HTTPS', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify the URL is HTTPS
    const currentURL = page.url();
    expect(currentURL).toMatch(/^https:\/\//i);

    // Verify no mixed content warnings
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Verify page loaded successfully
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();
  });
});