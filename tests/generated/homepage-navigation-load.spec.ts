import { test, expect } from '@playwright/test';

test.describe('Homepage Navigation and Load', () => {
  const BASE_URL = 'https://niranjan17122002.github.io/playwright-test-target/';

  test('POSITIVE: Homepage loads successfully with valid URL and displays expected content', async ({ page }) => {
    // Navigate to the homepage
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify page title
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);

    // Verify main heading is visible
    const mainHeading = page.locator('h1, h2, [role="heading"]').first();
    await expect(mainHeading).toBeVisible();

    // Verify page content is loaded
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Verify URL matches expected
    expect(page.url()).toContain('niranjan17122002.github.io/playwright-test-target');
  });

  test('NEGATIVE: Homepage fails to load with invalid URL', async ({ page }) => {
    // Attempt to navigate to invalid URL
    const response = await page.goto('https://niranjan17122002.github.io/invalid-route-12345/', {
      waitUntil: 'networkidle'
    }).catch(error => null);

    // Verify navigation fails or returns error status
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('POSITIVE: Verify page responds within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Verify page loads within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('NEGATIVE: Verify error handling when network is unavailable', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);

    // Attempt to navigate
    const error = await page.goto(BASE_URL).catch(err => err);
    expect(error).toBeTruthy();

    // Restore online mode
    await context.setOffline(false);
  });

  test('BOUNDARY: Verify homepage with various viewport sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('VALIDATION: Verify page structure and essential elements exist', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify HTML structure
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify body element exists
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify at least one heading exists
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });
});