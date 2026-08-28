import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'https://niranjan17122002.github.io/playwright-test-target/';

test.describe('View the about page', () => {
  test('POSITIVE: About page loads and presents its informational heading and content', async ({ page }) => {
    // Open the about page.
    await page.goto(`${baseURL}/about.html`, { waitUntil: 'domcontentloaded' });

    // Confirm we actually landed on the about page.
    await expect(page).toHaveURL(/about\.html$/);

    // Verify the about page heading is visible (the h1, not the sidebar/nav link).
    const aboutHeading = page.getByRole('heading', { name: 'About', level: 1 });
    await expect(aboutHeading).toBeVisible();

    // Verify the about page content is displayed.
    const aboutContent = page.locator('main p').first();
    await expect(aboutContent).toBeVisible();
    await expect(aboutContent).toContainText('A minimal static app with a login form and a contact form');
  });

  test('NEGATIVE: About page presents informational content only, with no login/contact forms', async ({ page }) => {
    // Open the about page.
    await page.goto(`${baseURL}/about.html`, { waitUntil: 'domcontentloaded' });

    // The informational heading is still shown...
    await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();

    // ...but no interactive form content is rendered: the page is purely informational.
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
  });
});