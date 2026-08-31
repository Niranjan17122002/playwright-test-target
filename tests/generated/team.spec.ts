import { test, expect } from '@playwright/test';

test('POSITIVE: View the Team page after logging in with valid credentials', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#nav-login').click();
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
  await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
  await page.locator('#login-submit').click();

  await page.waitForURL(url => !url.toString().includes('login.html'), { timeout: 15000 });

  await page.locator('#nav-team').click();
  await page.waitForURL(url => url.toString().includes('team/index.html'), { timeout: 15000 });

  await expect(page.locator('h1')).toHaveText('Team');
  await expect(page.locator('#team-list .list-item')).toHaveCount(4);
  await expect(page.locator('#team-list')).toContainText('Priya Nair');
});

test('NEGATIVE: Invalid credentials are rejected on the login page', async ({ page }) => {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });

  await page.locator('#username').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#username').fill('WrongUser123!');
  await page.locator('#password').fill('WrongPassword123!');
  await page.locator('#login-submit').click();

  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/login\.html$/);
});