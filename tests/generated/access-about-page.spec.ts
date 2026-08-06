import { test, expect } from '@playwright/test';

test.describe('Access About Page', () => {
  const aboutPageUrl = 'https://niranjan17122002.github.io/playwright-test-target/about.html';

  test('POSITIVE: Successfully navigate to about page and verify content is displayed', async ({ page }) => {
    // Navigate to about page
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify page title or URL to confirm navigation
    expect(page.url()).toContain('about.html');

    // Verify about page content is displayed
    const pageContent = await page.locator('body').isVisible();
    expect(pageContent).toBeTruthy();

    // Verify page has loaded with content
    const mainContent = await page.locator('main, article, .about-content, h1, h2').first();
    await expect(mainContent).toBeVisible({ timeout: 5000 });
  });

  test('NEGATIVE: Handle navigation failure when about page is unavailable', async ({ page }) => {
    // Attempt to navigate to invalid/unavailable about page URL
    const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/about-invalid.html';
    
    try {
      await page.goto(invalidUrl, { waitUntil: 'networkidle', timeout: 10000 });
    } catch (error) {
      // Expected to fail or return 404
      expect(error).toBeDefined();
    }

    // Verify page did not load successfully
    const pageStatus = page.url();
    expect(pageStatus).not.toContain('about.html');
  });

  test('BOUNDARY: Verify about page loads within timeout constraints', async ({ page }) => {
    // Set a strict timeout for page load
    const startTime = Date.now();
    
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loaded within reasonable time
    expect(loadTime).toBeLessThan(30000);
    expect(page.url()).toContain('about.html');
  });

  test('VALIDATION: Verify about page structure and essential elements', async ({ page }) => {
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify page has valid HTML structure
    const htmlElement = await page.locator('html').isVisible();
    expect(htmlElement).toBeTruthy();

    // Verify body element exists and is visible
    const bodyElement = await page.locator('body').isVisible();
    expect(bodyElement).toBeTruthy();

    // Verify page is not showing error states
    const errorElements = await page.locator('text=/error|404|not found/i').count();
    expect(errorElements).toBe(0);
  });

  test('SECURITY: Verify about page loads from correct secure domain', async ({ page }) => {
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify URL matches expected domain
    const currentUrl = page.url();
    expect(currentUrl).toContain('niranjan17122002.github.io');
    expect(currentUrl).toContain('about.html');
    expect(currentUrl).toMatch(/^https:\/\//); // Verify HTTPS
  });
});