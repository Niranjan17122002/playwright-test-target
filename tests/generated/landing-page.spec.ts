import { test, expect } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL ?? 'https://niranjan17122002.github.io/playwright-test-target/';

test('POSITIVE: Landing page loads and homepage content renders', async ({ page }) => {
  // Open the landing page (the application entry point)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Verify the page title is the homepage title, not a sub-page's
  await expect(page).toHaveTitle('Test Target App');

  // Verify the homepage heading renders with the real text from index.html
  const heading = page.getByRole('heading', { name: 'Welcome', exact: true });
  await expect(heading).toBeVisible();

  // Verify the main content paragraph renders with its real copy
  const main = page.locator('main');
  await expect(
    main.getByText('This is a small static site used to test the Playwright automation accelerator.')
  ).toBeVisible();

  // Verify the secondary paragraph plus its inline Login / Contact links
  const tryLinks = main.locator('p').filter({ hasText: 'Try the Login or Contact pages.' });
  await expect(tryLinks).toBeVisible();
  await expect(tryLinks.getByRole('link', { name: 'Login' })).toBeVisible();
  await expect(tryLinks.getByRole('link', { name: 'Contact' })).toBeVisible();

  // Verify the top navigation renders all six links (scoped to <nav> because
  // 'Login' and 'Contact' also appear inside the main content paragraph)
  const nav = page.locator('nav');
  for (const label of ['Home', 'Login', 'Dashboard', 'Team', 'Contact', 'About']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});

test('NEGATIVE: Landing page does not render content belonging to other pages', async ({ page }) => {
  // Open the landing page
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // The title must stay the homepage title, not a sub-page's
  await expect(page).toHaveTitle('Test Target App');

  // Login page content (heading and form) must not be present
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toHaveCount(0);
  await expect(page.locator('#login-form')).toHaveCount(0);

  // Dashboard page content (heading and task form) must not be present
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await expect(page.locator('#add-task-form')).toHaveCount(0);

  // Authenticated welcome page heading must not be present
  await expect(page.getByRole('heading', { name: 'Welcome, demo!', exact: true })).toHaveCount(0);

  // Final guard: the real homepage heading 'Welcome' is the one that IS present
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toHaveCount(1);
});