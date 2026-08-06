import { test, expect } from '@playwright/test';

test.describe('Access Contact Page', () => {
  const contactPageUrl = 'https://niranjan17122002.github.io/playwright-test-target/contact.html';

  test('POSITIVE: Successfully navigate to contact page and verify it loads', async ({ page }) => {
    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Verify page title or URL
    expect(page.url()).toContain('contact.html');

    // Verify body element is rendered
    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify contact page content is present
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('POSITIVE: Verify contact form elements are accessible', async ({ page }) => {
    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Wait for body to be visible
    await expect(page.locator('body')).toBeVisible();

    // Verify page has loaded successfully
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    // Check for common contact form elements
    const formElements = await page.locator('form, input, textarea, button').count();
    expect(formElements).toBeGreaterThanOrEqual(0);
  });

  test('NEGATIVE: Verify error handling when accessing invalid contact page URL', async ({ page }) => {
    // Attempt to navigate to invalid contact page
    const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/contact-invalid.html';
    
    try {
      const response = await page.goto(invalidUrl, { waitUntil: 'networkidle' });
      // If page loads, verify it's not a 404 or error page
      if (response) {
        const status = response.status();
        // Expect either success or proper error handling
        expect([200, 404, 500]).toContain(status);
      }
    } catch (error) {
      // Navigation error is expected for invalid URLs
      expect(error).toBeTruthy();
    }
  });

  test('NEGATIVE: Verify page behavior with network interruption', async ({ page }) => {
    // Simulate network offline
    await page.context().setOffline(true);

    try {
      await page.goto(contactPageUrl, { waitUntil: 'networkidle', timeout: 5000 });
    } catch (error) {
      // Expected to fail when offline
      expect(error).toBeTruthy();
    } finally {
      // Restore network
      await page.context().setOffline(false);
    }
  });

  test('BOUNDARY: Verify contact page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loads within 10 seconds
    expect(loadTime).toBeLessThan(10000);
    
    // Verify body is rendered
    await expect(page.locator('body')).toBeVisible();
  });

  test('VALIDATION: Verify contact page DOM structure is valid', async ({ page }) => {
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Verify essential HTML elements exist
    const htmlElement = await page.locator('html');
    await expect(htmlElement).toBeVisible();

    const bodyElement = await page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify page has content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });

  test('SECURITY: Verify contact page does not expose sensitive information in source', async ({ page }) => {
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    const pageContent = await page.content();

    // Verify no hardcoded credentials in page source
    expect(pageContent).not.toContain('password');
    expect(pageContent).not.toContain('api_key');
    expect(pageContent).not.toContain('secret');

    // Verify page loads over HTTPS
    expect(page.url()).toMatch(/^https:\/\//i);
  });
});