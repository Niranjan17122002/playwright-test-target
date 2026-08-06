import { test, expect } from '@playwright/test';

test.describe('Access Contact Page', () => {
  const contactPageUrl = 'https://niranjan17122002.github.io/playwright-test-target/contact.html';

  test.describe('Positive Scenarios', () => {
    test('should successfully navigate to contact page and verify form elements are visible', async ({ page }) => {
      // Navigate to contact page
      await page.goto(contactPageUrl);
      
      // Wait for network to be idle
      await page.waitForLoadState('networkidle');
      
      // Verify contact form is visible
      const contactForm = page.locator('form');
      await expect(contactForm).toBeVisible();
      
      // Verify input elements are visible
      const inputElements = page.locator('input');
      await expect(inputElements.first()).toBeVisible();
      
      // Verify textarea element is visible
      const textareaElement = page.locator('textarea');
      await expect(textareaElement).toBeVisible();
    });

    test('should load contact page with all required form fields', async ({ page }) => {
      // Navigate to contact page
      await page.goto(contactPageUrl);
      
      // Wait for network to be idle
      await page.waitForLoadState('networkidle');
      
      // Verify page title or heading contains contact-related text
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain('contact');
      
      // Verify form exists and is accessible
      const form = page.locator('form');
      await expect(form).toHaveCount(1);
      
      // Verify at least one input field exists
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);
      
      // Verify textarea exists for message input
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
    });
  });

  test.describe('Negative Scenarios', () => {
    test('should handle navigation to invalid contact page URL gracefully', async ({ page }) => {
      // Attempt to navigate to non-existent contact page
      const invalidUrl = 'https://niranjan17122002.github.io/playwright-test-target/invalid-contact.html';
      
      const response = await page.goto(invalidUrl, { waitUntil: 'networkidle' }).catch(() => null);
      
      // Verify page either returns 404 or shows error
      if (response) {
        expect([404, 500]).toContain(response.status());
      }
    });

    test('should verify contact form is not accessible when page fails to load', async ({ page }) => {
      // Attempt navigation with network offline simulation
      await page.context().setOffline(true);
      
      const response = await page.goto(contactPageUrl, { waitUntil: 'networkidle' }).catch(() => null);
      
      // Verify form is not visible when offline
      const contactForm = page.locator('form');
      const isVisible = await contactForm.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
      
      // Restore online state
      await page.context().setOffline(false);
    });

    test('should handle missing form elements gracefully', async ({ page }) => {
      // Navigate to contact page
      await page.goto(contactPageUrl);
      await page.waitForLoadState('networkidle');
      
      // Verify form elements exist (negative test for missing elements)
      const form = page.locator('form');
      const formExists = await form.count().then(count => count > 0);
      
      if (!formExists) {
        // If form doesn't exist, verify page still loaded
        const pageTitle = await page.title();
        expect(pageTitle).toBeTruthy();
      } else {
        // If form exists, verify it has expected structure
        await expect(form).toBeVisible();
      }
    });
  });

  test.describe('Boundary Scenarios', () => {
    test('should handle rapid navigation to contact page', async ({ page }) => {
      // Navigate multiple times rapidly
      for (let i = 0; i < 3; i++) {
        await page.goto(contactPageUrl);
        await page.waitForLoadState('networkidle');
      }
      
      // Verify form is still visible after rapid navigation
      const contactForm = page.locator('form');
      await expect(contactForm).toBeVisible();
    });

    test('should verify contact page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(contactPageUrl);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      
      // Verify form is visible
      const contactForm = page.locator('form');
      await expect(contactForm).toBeVisible();
    });
  });

  test.describe('Validation Scenarios', () => {
    test('should verify all required form elements are present and accessible', async ({ page }) => {
      await page.goto(contactPageUrl);
      await page.waitForLoadState('networkidle');
      
      // Verify form element
      const form = page.locator('form');
      await expect(form).toBeVisible();
      await expect(form).toHaveCount(1);
      
      // Verify input elements
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);
      
      // Verify each input is visible and enabled
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();
      }
      
      // Verify textarea element
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeEnabled();
    });

    test('should verify contact form is interactive', async ({ page }) => {
      await page.goto(contactPageUrl);
      await page.waitForLoadState('networkidle');
      
      // Verify form can receive focus
      const form = page.locator('form');
      await form.focus();
      
      // Verify input fields can be filled
      const firstInput = page.locator('input').first();
      await firstInput.fill('Test Input');
      const inputValue = await firstInput.inputValue();
      expect(inputValue).toBe('Test Input');
      
      // Verify textarea can be filled
      const textarea = page.locator('textarea');
      await textarea.fill('Test Message');
      const textareaValue = await textarea.inputValue();
      expect(textareaValue).toBe('Test Message');
    });
  });
});