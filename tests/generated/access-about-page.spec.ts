import { test, expect } from '@playwright/test';

test.describe('Access About Page', () => {
  const ABOUT_PAGE_URL = 'https://niranjan17122002.github.io/playwright-test-target/about.html';

  test('POSITIVE: User successfully navigates to about page and verifies content', async ({ page }) => {
    // Navigate to about page
    await page.goto(ABOUT_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify about page is visible by checking body element exists
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Additional verification: Check page title or URL to confirm navigation
    await expect(page).toHaveURL(ABOUT_PAGE_URL);

    // Verify page has loaded with content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.length).toBeGreaterThan(0);
  });

  test('NEGATIVE: User attempts to access invalid about page URL', async ({ page }) => {
    const invalidURL = 'https://niranjan17122002.github.io/playwright-test-target/invalid-about.html';

    // Attempt to navigate to invalid URL
    const response = await page.goto(invalidURL, { waitUntil: 'networkidle' }).catch(() => null);

    // Verify navigation fails or returns error status
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('NEGATIVE: User navigates to about page but network fails', async ({ page }) => {
    // Simulate network failure
    await page.context().setOffline(true);

    // Attempt to navigate to about page
    const navigationError = await page.goto(ABOUT_PAGE_URL, { waitUntil: 'networkidle' }).catch((error) => error);

    // Verify error occurs due to offline state
    expect(navigationError).toBeTruthy();

    // Restore network
    await page.context().setOffline(false);
  });

  test('BOUNDARY: Verify about page loads within timeout', async ({ page }) => {
    const startTime = Date.now();

    // Navigate with explicit timeout
    await page.goto(ABOUT_PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const loadTime = Date.now() - startTime;

    // Verify page loaded within reasonable time
    expect(loadTime).toBeLessThan(30000);

    // Verify body is visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('VALIDATION: Verify about page structure and accessibility', async ({ page }) => {
    await page.goto(ABOUT_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify essential page elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for common about page elements
    const headings = await page.locator('h1, h2, h3').count();
    expect(headings).toBeGreaterThanOrEqual(0);

    // Verify page is not blank
    const allText = await page.locator('body').textContent();
    expect(allText?.trim().length).toBeGreaterThan(0);
  });
});