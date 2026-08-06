import { test, expect } from '@playwright/test';

test.describe('About Page Access', () => {
  const aboutPageUrl = 'https://niranjan17122002.github.io/playwright-test-target/about.html';

  test('POSITIVE: Successfully navigate to About page and verify content loads', async ({ page }) => {
    // Navigate to the About page
    await page.goto(aboutPageUrl);

    // Verify page loaded successfully
    await expect(page).toHaveURL(aboutPageUrl);

    // Verify page title or heading exists
    const pageHeading = page.locator('h1, h2, [role="heading"]').first();
    await expect(pageHeading).toBeVisible();

    // Verify page content is not empty
    const pageContent = page.locator('body');
    await expect(pageContent).toContainText(/./); // At least some text content

    // Verify page status is successful
    const response = await page.goto(aboutPageUrl);
    expect(response?.status()).toBe(200);
  });

  test('NEGATIVE: Handle navigation to non-existent About page variant', async ({ page }) => {
    // Attempt to navigate to a malformed URL
    const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/about-invalid.html';
    
    const response = await page.goto(invalidUrl, { waitUntil: 'networkidle' });
    
    // Verify that the response is not successful (404 or similar)
    expect(response?.status()).not.toBe(200);
  });

  test('BOUNDARY: Verify About page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(aboutPageUrl, { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loaded within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Verify page is interactive
    await expect(page).toHaveURL(aboutPageUrl);
  });

  test('VALIDATION: Verify About page structure and essential elements', async ({ page }) => {
    await page.goto(aboutPageUrl);

    // Verify page has a valid HTML structure
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify body element exists
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify page is not showing error messages
    const errorIndicators = page.locator('text=/error|404|not found/i');
    await expect(errorIndicators).toHaveCount(0);
  });

  test('SECURITY: Verify About page does not expose sensitive information in URL', async ({ page }) => {
    await page.goto(aboutPageUrl);

    // Verify URL does not contain sensitive parameters
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('password');
    expect(currentUrl).not.toContain('token');
    expect(currentUrl).not.toContain('api_key');
    expect(currentUrl).not.toContain('secret');
  });
});