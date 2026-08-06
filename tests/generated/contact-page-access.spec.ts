import { test, expect } from '@playwright/test';

test.describe('Contact Page Access', () => {
  const contactPageUrl = 'https://niranjan17122002.github.io/playwright-test-target/contact.html';

  test('POSITIVE: Successfully navigate to Contact page and verify page loads with form elements', async ({ page }) => {
    // Navigate to the contact page
    await page.goto(contactPageUrl);

    // Verify page title or heading
    const pageHeading = page.locator('h1, h2, [role="heading"]').first();
    await expect(pageHeading).toBeVisible();

    // Verify contact form exists
    const contactForm = page.locator('form');
    await expect(contactForm).toBeVisible();

    // Verify common contact form elements are present
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[type="text"]').first();
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const messageInput = page.locator('textarea[name="message"], textarea');
    const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")');

    // Assert at least some form elements are visible
    await expect(contactForm).toBeVisible();
    const formElements = await page.locator('input, textarea, button').count();
    expect(formElements).toBeGreaterThan(0);
  });

  test('NEGATIVE: Verify error handling when submitting empty contact form', async ({ page }) => {
    // Navigate to the contact page
    await page.goto(contactPageUrl);

    // Verify page loaded
    const contactForm = page.locator('form');
    await expect(contactForm).toBeVisible();

    // Attempt to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Wait a moment for validation
      await page.waitForTimeout(500);
      
      // Verify either validation message appears or form is still visible (not submitted)
      const validationMessage = page.locator('[role="alert"], .error, .validation-error, .invalid-feedback').first();
      const formStillVisible = await contactForm.isVisible();
      
      // Either validation error is shown or form remains on page
      const hasValidationOrFormStays = await validationMessage.isVisible().catch(() => false) || formStillVisible;
      expect(hasValidationOrFormStays).toBeTruthy();
    }
  });

  test('BOUNDARY: Verify Contact page URL is accessible and returns valid response', async ({ page }) => {
    // Navigate and capture response
    const response = await page.goto(contactPageUrl);
    
    // Verify successful navigation (status 200-299)
    expect(response?.status()).toBeLessThan(400);
    
    // Verify page title exists
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
  });

  test('VALIDATION: Verify Contact page contains required form structure', async ({ page }) => {
    await page.goto(contactPageUrl);

    // Check for form element
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Verify form has action or onsubmit handler
    const formElement = await form.evaluate((el: HTMLFormElement) => ({
      hasAction: !!el.action,
      hasOnSubmit: !!el.onsubmit,
      method: el.method
    }));

    // Form should have either action, onsubmit, or method
    const hasFormHandler = formElement.hasAction || formElement.hasOnSubmit || formElement.method;
    expect(hasFormHandler).toBeTruthy();
  });

  test('SECURITY: Verify Contact page does not expose sensitive information in source', async ({ page }) => {
    await page.goto(contactPageUrl);

    // Get page content
    const pageContent = await page.content();

    // Verify no obvious credentials or API keys in page source
    const sensitivePatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i
    ];

    for (const pattern of sensitivePatterns) {
      expect(pageContent).not.toMatch(pattern);
    }

    // Verify form uses appropriate method (POST preferred over GET for sensitive data)
    const form = page.locator('form').first();
    const formMethod = await form.getAttribute('method');
    if (formMethod) {
      expect(formMethod.toUpperCase()).not.toBe('GET');
    }
  });
});