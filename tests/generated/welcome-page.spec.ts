import { test, expect } from '@playwright/test';

test.describe('Navigate to Welcome Page', () => {
  const welcomePageUrl = 'https://niranjan17122002.github.io/playwright-test-target/welcome.html';

  test('POSITIVE: Successfully navigate to welcome page and verify content loads', async ({ page }) => {
    // Navigate to welcome page
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle' });

    // Verify page title or URL to confirm successful navigation
    expect(page.url()).toContain('welcome.html');

    // Verify welcome page content is displayed
    const welcomeContent = page.locator('body');
    await expect(welcomeContent).toBeVisible();

    // Verify page has loaded with content
    const pageTitle = page.locator('h1, h2, [role="heading"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
  });

  test('NEGATIVE: Handle navigation failure with invalid URL', async ({ page }) => {
    // Attempt to navigate to invalid/malformed URL
    const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/invalid-page.html';
    
    // Navigate and expect page not found or error
    const response = await page.goto(invalidUrl, { waitUntil: 'networkidle' }).catch(() => null);
    
    // Verify error handling - page should not contain welcome content
    const welcomeContent = page.locator('h1, h2, [role="heading"]').first();
    const isVisible = await welcomeContent.isVisible().catch(() => false);
    
    // Either response is null/error or content is not visible
    expect(response === null || !isVisible || response.status() >= 400).toBeTruthy();
  });

  test('BOUNDARY: Verify welcome page loads within timeout', async ({ page }) => {
    // Set a reasonable timeout for page load
    const startTime = Date.now();
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;

    // Verify page loaded within acceptable time (less than 30 seconds)
    expect(loadTime).toBeLessThan(30000);
    expect(page.url()).toContain('welcome.html');
  });

  test('VALIDATION: Verify welcome page DOM structure and accessibility', async ({ page }) => {
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle' });

    // Verify page has proper HTML structure
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify body element exists and is visible
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify at least one heading exists for accessibility
    const headings = page.locator('h1, h2, h3, [role="heading"]');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });

  test('SECURITY: Verify welcome page loads over HTTPS', async ({ page }) => {
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle' });

    // Verify URL uses HTTPS protocol
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/^https:\/\//i);
    expect(currentUrl).toContain('welcome.html');
  });
});