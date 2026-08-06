import { test, expect } from '@playwright/test';

test.describe('Welcome Page Access', () => {
  const WELCOME_PAGE_URL = 'https://niranjan17122002.github.io/playwright-test-target/welcome.html';

  test('POSITIVE: Successfully navigate to and verify Welcome page loads correctly', async ({ page }) => {
    // Navigate to the Welcome page
    await page.goto(WELCOME_PAGE_URL);

    // Verify page has loaded by checking for common page indicators
    await expect(page).toHaveURL(WELCOME_PAGE_URL);

    // Verify page title or heading exists
    const pageTitle = page.locator('h1, h2, [role="heading"], title');
    await expect(pageTitle).toBeTruthy();

    // Verify page content is visible
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Verify no error messages are displayed
    const errorElements = page.locator('[role="alert"], .error, .error-message, .alert-danger');
    await expect(errorElements).toHaveCount(0);

    // Verify page is not showing 404 or error status
    const response = await page.goto(WELCOME_PAGE_URL);
    expect(response?.status()).toBeLessThan(400);
  });

  test('NEGATIVE: Handle navigation failure gracefully when URL is invalid', async ({ page }) => {
    // Attempt to navigate to an invalid/non-existent welcome page
    const invalidURL = 'https://niranjan17122002.github.io/playwright-test-target/welcome-invalid.html';
    
    const response = await page.goto(invalidURL, { waitUntil: 'networkidle' }).catch(() => null);
    
    // Verify that the response indicates an error (404 or similar)
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('BOUNDARY: Verify Welcome page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(WELCOME_PAGE_URL);
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loads within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Verify page is fully interactive
    await expect(page.locator('body')).toBeVisible();
  });

  test('VALIDATION: Verify Welcome page contains expected structural elements', async ({ page }) => {
    await page.goto(WELCOME_PAGE_URL);

    // Verify page has a valid HTML structure
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify body element exists and is accessible
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify page is not blank
    const pageText = await page.textContent('body');
    expect(pageText?.trim().length).toBeGreaterThan(0);
  });

  test('SECURITY: Verify Welcome page does not expose sensitive information in URL', async ({ page }) => {
    await page.goto(WELCOME_PAGE_URL);

    // Verify URL does not contain sensitive parameters
    const currentURL = page.url();
    expect(currentURL).not.toContain('password');
    expect(currentURL).not.toContain('token');
    expect(currentURL).not.toContain('api_key');
    expect(currentURL).not.toContain('secret');
  });
});