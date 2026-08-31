import { test, expect } from '@playwright/test';

test.describe('About page', () => {
  test('POSITIVE: About page content is displayed after clicking the About link from home', async ({ page }) => {
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle('Test Target App');
    await page.locator('#nav-about').click();

    await expect(page).toHaveURL(/about\.html$/);
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
    await expect(page.locator('main p')).toContainText('multi-step wizard');
  });

  test('NEGATIVE: About page is publicly accessible without login credentials', async ({ page }) => {
    await page.goto('about.html', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle('About - Test Target App');
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
    await expect(page.locator('main p')).toContainText('A small static app');
    await expect(page.locator('#login-form')).toHaveCount(0);
  });
});