import { test, expect } from '@playwright/test';

test.describe('Access Contact Page Journey', () => {
  const baseUrl = 'https://niranjan17122002.github.io/playwright-test-target';
  const contactPageUrl = `${baseUrl}/contact.html`;

  test('POSITIVE: Successfully navigate to contact page and verify content is displayed', async ({ page }) => {
    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Verify page loaded successfully
    await expect(page).toHaveURL(contactPageUrl);

    // Verify contact page content is displayed
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    // Verify contact form or contact information exists
    const contactForm = page.locator('form, [class*="contact"], [id*="contact"]').first();
    await expect(contactForm).toBeVisible();

    // Verify page has loaded completely
    const bodyContent = page.locator('body');
    await expect(bodyContent).toBeVisible();
  });

  test('NEGATIVE: Handle navigation to non-existent contact page gracefully', async ({ page }) => {
    // Attempt to navigate to invalid contact page URL
    const invalidUrl = `${baseUrl}/contact-invalid.html`;
    
    const response = await page.goto(invalidUrl, { waitUntil: 'networkidle' }).catch(() => null);
    
    // Verify that either page returns 404 or navigation fails
    if (response) {
      expect([404, 500]).toContain(response.status());
    }
  });

  test('BOUNDARY: Verify contact page loads with network throttling', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });

    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Verify page still loads and content is visible
    await expect(page).toHaveURL(contactPageUrl);
    const contactForm = page.locator('form, [class*="contact"], [id*="contact"]').first();
    await expect(contactForm).toBeVisible({ timeout: 10000 });
  });

  test('VALIDATION: Verify contact page HTML structure and accessibility', async ({ page }) => {
    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Verify page has proper HTML structure
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();

    // Verify page has a body element
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Verify contact page has meaningful content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
    expect(pageContent.toLowerCase()).toContain('contact');
  });

  test('SECURITY: Verify contact page does not expose sensitive information in source', async ({ page }) => {
    // Navigate to contact page
    await page.goto(contactPageUrl, { waitUntil: 'networkidle' });

    // Get page source
    const pageSource = await page.content();

    // Verify no hardcoded credentials or sensitive data patterns
    expect(pageSource).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
    expect(pageSource).not.toMatch(/api[_-]?key\s*=\s*['"][^'"]+['"]/i);
    expect(pageSource).not.toMatch(/secret\s*=\s*['"][^'"]+['"]/i);
  });
});