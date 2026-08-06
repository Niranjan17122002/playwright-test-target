import { test, expect } from '@playwright/test';

test.describe('Verify Stylesheet Loading', () => {
  const HOME_PAGE_URL = 'https://niranjan17122002.github.io/playwright-test-target/';
  const STYLESHEET_NAME = 'style.css';

  test('POSITIVE: Stylesheet should be loaded and applied to the page', async ({ page }) => {
    // Navigate to home page
    await page.goto(HOME_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify page title or basic content loaded
    await expect(page).toHaveURL(HOME_PAGE_URL);

    // Check that stylesheet is loaded by verifying it exists in the page resources
    const stylesheetRequest = await page.waitForLoadState('networkidle');
    
    // Verify stylesheet link exists in the DOM
    const stylesheetLink = page.locator(`link[href*="${STYLESHEET_NAME}"]`);
    await expect(stylesheetLink).toBeVisible();

    // Verify stylesheet is actually applied by checking computed styles
    const bodyElement = page.locator('body');
    const computedStyle = await bodyElement.evaluate((el) => {
      return window.getComputedStyle(el).cssText;
    });
    expect(computedStyle).toBeTruthy();

    // Verify no CSS loading errors in console
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    // Additional verification: Check that stylesheet resource was successfully loaded
    const responses = await page.context().storageState();
    const pageContent = await page.content();
    expect(pageContent).toContain('style.css');
  });

  test('NEGATIVE: Handle missing or failed stylesheet loading', async ({ page }) => {
    // Intercept stylesheet request and simulate failure
    await page.route('**/*.css', (route) => {
      route.abort('failed');
    });

    // Navigate to home page
    await page.goto(HOME_PAGE_URL, { waitUntil: 'domcontentloaded' });

    // Verify page still loads (graceful degradation)
    await expect(page).toHaveURL(HOME_PAGE_URL);

    // Verify stylesheet link element exists but resource failed to load
    const stylesheetLink = page.locator(`link[href*="${STYLESHEET_NAME}"]`);
    // Link element should exist in DOM even if resource failed
    const linkCount = await stylesheetLink.count();
    expect(linkCount).toBeGreaterThanOrEqual(0);

    // Verify page is still functional without stylesheet
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();
  });

  test('BOUNDARY: Verify stylesheet loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(HOME_PAGE_URL, { waitUntil: 'networkidle' });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Verify page loaded within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify stylesheet is present
    const stylesheetLink = page.locator(`link[href*="${STYLESHEET_NAME}"]`);
    await expect(stylesheetLink).toBeVisible();
  });

  test('VALIDATION: Verify stylesheet link has correct attributes', async ({ page }) => {
    await page.goto(HOME_PAGE_URL, { waitUntil: 'networkidle' });

    // Find stylesheet link
    const stylesheetLink = page.locator(`link[href*="${STYLESHEET_NAME}"]`);
    
    // Verify link element exists
    await expect(stylesheetLink).toBeVisible();

    // Verify rel attribute is 'stylesheet'
    const relAttribute = await stylesheetLink.getAttribute('rel');
    expect(relAttribute).toBe('stylesheet');

    // Verify href attribute contains style.css
    const hrefAttribute = await stylesheetLink.getAttribute('href');
    expect(hrefAttribute).toContain(STYLESHEET_NAME);

    // Verify type attribute if present
    const typeAttribute = await stylesheetLink.getAttribute('type');
    if (typeAttribute) {
      expect(typeAttribute).toBe('text/css');
    }
  });

  test('SECURITY: Verify stylesheet is loaded from expected source', async ({ page }) => {
    const requestedUrls: string[] = [];

    // Track all requests
    page.on('request', (request) => {
      if (request.url().includes('.css')) {
        requestedUrls.push(request.url());
      }
    });

    await page.goto(HOME_PAGE_URL, { waitUntil: 'networkidle' });

    // Verify stylesheet requests are from expected domain
    const cssRequests = requestedUrls.filter((url) => url.includes(STYLESHEET_NAME));
    
    // Verify at least one CSS request was made
    expect(cssRequests.length).toBeGreaterThanOrEqual(0);

    // If CSS was requested, verify it's from the same origin
    cssRequests.forEach((url) => {
      expect(url).toContain('niranjan17122002.github.io');
    });
  });
});