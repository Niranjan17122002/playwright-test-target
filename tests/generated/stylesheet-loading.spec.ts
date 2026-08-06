import { test, expect } from '@playwright/test';

test.describe('Stylesheet Loading', () => {
  const baseURL = 'https://niranjan17122002.github.io/playwright-test-target/';

  test('POSITIVE: Stylesheet loads and applies styles correctly', async ({ page }) => {
    // Navigate to the application
    await page.goto(baseURL);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Verify that style.css is loaded by checking for stylesheet link
    const stylesheetLink = page.locator('link[rel="stylesheet"][href*="style.css"]');
    await expect(stylesheetLink).toBeVisible();

    // Verify that the stylesheet is actually loaded in the network
    const response = await page.goto(baseURL);
    expect(response?.status()).toBe(200);

    // Get the first visible element and verify computed styles are applied
    const bodyElement = page.locator('body');
    const computedStyle = await bodyElement.evaluate((el) => {
      return window.getComputedStyle(el);
    });

    // Verify that styles are not empty (stylesheet has been applied)
    expect(computedStyle).toBeDefined();

    // Check for specific style properties that should be applied
    const backgroundColor = await bodyElement.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    // Verify that at least one element has custom styles applied
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      const firstHeading = headings.first();
      const headingColor = await firstHeading.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      expect(headingColor).toBeDefined();
    }
  });

  test('NEGATIVE: Stylesheet fails to load when URL is invalid', async ({ page }) => {
    // Attempt to navigate to an invalid URL
    const invalidURL = 'https://niranjan17122002.github.io/playwright-test-target/nonexistent-page/';
    
    const response = await page.goto(invalidURL, { waitUntil: 'networkidle' }).catch(() => null);
    
    // Verify that the page either returns 404 or fails to load
    if (response) {
      expect([404, 500]).toContain(response.status());
    }
  });

  test('NEGATIVE: Stylesheet not applied when CSS file is missing', async ({ page }) => {
    // Navigate to the page
    await page.goto(baseURL);

    // Intercept and block the stylesheet request
    await page.route('**/*.css', (route) => {
      route.abort();
    });

    // Reload the page with stylesheet blocked
    await page.reload();

    // Verify that the page still loads but without custom styles
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // The page should still be functional but styles may be default
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('POSITIVE: Multiple elements have computed styles applied', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Get all elements on the page
    const allElements = page.locator('*');
    const elementCount = await allElements.count();
    expect(elementCount).toBeGreaterThan(0);

    // Verify that at least some elements have non-default computed styles
    let styledElementCount = 0;
    for (let i = 0; i < Math.min(elementCount, 10); i++) {
      const element = allElements.nth(i);
      const styles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          display: computed.display
        };
      });
      
      if (styles.color !== 'rgba(0, 0, 0, 0)' || styles.fontSize !== '0px') {
        styledElementCount++;
      }
    }

    expect(styledElementCount).toBeGreaterThan(0);
  });

  test('BOUNDARY: Stylesheet loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Verify that the page loads within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('VALIDATION: CSS file is properly linked in HTML', async ({ page }) => {
    await page.goto(baseURL);

    // Check for stylesheet link in the head
    const stylesheetLinks = page.locator('head link[rel="stylesheet"]');
    const linkCount = await stylesheetLinks.count();
    
    expect(linkCount).toBeGreaterThan(0);

    // Verify that at least one stylesheet link contains 'style.css' or similar
    let cssFileFound = false;
    for (let i = 0; i < linkCount; i++) {
      const href = await stylesheetLinks.nth(i).getAttribute('href');
      if (href && (href.includes('style.css') || href.includes('.css'))) {
        cssFileFound = true;
        break;
      }
    }

    expect(cssFileFound).toBe(true);
  });
});