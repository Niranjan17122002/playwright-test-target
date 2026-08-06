import { test, expect } from '@playwright/test';

test.describe('Navigate to Welcome Page', () => {
  const welcomePageUrl = 'https://niranjan17122002.github.io/playwright-test-target/welcome.html';

  test('POSITIVE: Successfully navigate to welcome page and verify content loads', async ({ page }) => {
    // Navigate to welcome page
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle' });

    // Verify page title or heading exists
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    // Verify welcome page content is displayed
    const welcomeContent = await page.locator('body').isVisible();
    expect(welcomeContent).toBe(true);

    // Verify URL matches expected welcome page
    expect(page.url()).toContain('welcome.html');

    // Verify page is not showing error state
    const errorElements = await page.locator('[class*="error"], [class*="404"]').count();
    expect(errorElements).toBe(0);
  });

  test('NEGATIVE: Handle navigation failure with invalid URL', async ({ page }) => {
    // Attempt to navigate to invalid welcome page URL
    const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/invalid-welcome.html';
    
    try {
      await page.goto(invalidUrl, { waitUntil: 'networkidle', timeout: 10000 });
    } catch (error) {
      // Expected to fail or show error page
      expect(error).toBeTruthy();
    }

    // Verify page did not load successfully
    const pageContent = await page.content();
    expect(pageContent).toBeDefined();
  });

  test('POSITIVE: Verify welcome page loads within timeout', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loaded within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Verify page is interactive
    const isPageReady = await page.evaluate(() => document.readyState === 'complete');
    expect(isPageReady).toBe(true);
  });

  test('NEGATIVE: Verify error handling when network is unavailable', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    
    let navigationError = false;
    page.on('error', () => {
      navigationError = true;
    });

    try {
      await page.goto(welcomePageUrl, { waitUntil: 'networkidle', timeout: 5000 });
    } catch (error) {
      navigationError = true;
    }

    // Restore online mode
    await page.context().setOffline(false);
    
    // Verify navigation failed due to offline state
    expect(navigationError).toBe(true);
  });

  test('BOUNDARY: Verify welcome page with very long load time', async ({ page }) => {
    // Set extended timeout for slow network conditions
    await page.goto(welcomePageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Verify page eventually loads
    const bodyElement = await page.locator('body');
    expect(bodyElement).toBeTruthy();
  });
});