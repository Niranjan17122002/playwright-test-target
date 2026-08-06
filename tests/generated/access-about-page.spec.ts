import { test, expect } from '@playwright/test';

test.describe('Access About Page', () => {
  const baseUrl = 'https://niranjan17122002.github.io/playwright-test-target';
  const aboutPageUrl = `${baseUrl}/about.html`;

  test('POSITIVE: Successfully navigate to about page and verify content is displayed', async ({ page }) => {
    // Navigate to about page
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify page title or URL to confirm navigation
    expect(page.url()).toContain('about.html');

    // Verify about page content is displayed
    const aboutContent = page.locator('body');
    await expect(aboutContent).toBeVisible();

    // Verify page has loaded with content
    const pageTitle = page.locator('h1, h2, [role="heading"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
  });

  test('NEGATIVE: Handle navigation failure with invalid URL', async ({ page }) => {
    // Attempt to navigate to non-existent about page
    const response = await page.goto(`${baseUrl}/about-invalid.html`, { waitUntil: 'networkidle' }).catch(() => null);

    // Verify that navigation failed or returned error status
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('BOUNDARY: Verify about page loads within timeout', async ({ page }) => {
    // Set a reasonable timeout for page load
    const startTime = Date.now();
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;

    // Verify page loaded within acceptable time
    expect(loadTime).toBeLessThan(30000);
    expect(page.url()).toContain('about.html');
  });

  test('VALIDATION: Verify about page structure and required elements', async ({ page }) => {
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify page is not blank
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
    expect(bodyContent?.length).toBeGreaterThan(0);

    // Verify common about page elements exist
    const hasHeading = await page.locator('h1, h2, h3').count().then(count => count > 0);
    expect(hasHeading).toBeTruthy();
  });

  test('SECURITY: Verify about page loads over HTTPS', async ({ page }) => {
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });

    // Verify URL uses HTTPS
    expect(page.url()).toMatch(/^https:\/\//i);
  });
});