import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

let consoleErrors: string[] = [];
const searchInput = (page: Page) => page.getByRole('textbox', { name: 'Search by name' });
const searchButton = (page: Page) => page.getByRole('button', { name: 'Search', exact: true });
const visibleItems = (page: Page) => page.locator('#team-list .list-item:visible');
const allItems = (page: Page) => page.locator('#team-list .list-item');
const emptyMessage = (page: Page) => page.locator('#team-empty-message');

async function report(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  if (axe.violations.length) test.info().annotations.push({ type: 'a11y-violations', description: axe.violations.map(v => `${v.id}: ${v.help}`).join(' | ') });
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
}

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(e.message));
  page.on('requestfailed', r => consoleErrors.push(`${r.method()} ${r.url()} failed: ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) consoleErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  await page.goto('team/index.html', { waitUntil: 'domcontentloaded' });
});

test('POSITIVE: searching by name filters the team list to matching members', async ({ page }) => {
  test.setTimeout(120000);
  await expect(allItems(page)).toHaveCount(4);
  await searchInput(page).fill('Priya');
  await expect(visibleItems(page)).toHaveCount(4);
  await searchButton(page).click();
  await expect(visibleItems(page)).toHaveCount(1);
  await expect(visibleItems(page)).toHaveText(/Priya Nair/);
  await expect(allItems(page).filter({ hasText: 'Sam Okafor' })).toBeHidden();
  await expect(allItems(page).filter({ hasText: 'Jordan Lee' })).toBeHidden();
  await expect(allItems(page).filter({ hasText: 'Maria Chen' })).toBeHidden();
  await expect(searchInput(page)).toHaveValue('Priya');
  await expect(emptyMessage(page)).toBeHidden();
  await report(page);
});

test('NEGATIVE: a name matching no member is rejected with the empty-state message', async ({ page }) => {
  await searchInput(page).fill('Zzz No Such Person');
  await searchButton(page).click();
  await expect(emptyMessage(page)).toBeVisible();
  await expect(emptyMessage(page)).toHaveText('No team members match your search.');
  await expect(visibleItems(page)).toHaveCount(0);
  await expect(allItems(page)).toHaveCount(4);
  await report(page);
});

test('BOUNDARY: an extreme-length query is accepted and yields the empty-state message', async ({ page }) => {
  const longQuery = 'a'.repeat(500);
  test.info().annotations.push({ type: 'test-data', description: `longQuery length: ${longQuery.length}` });
  await searchInput(page).fill(longQuery);
  await searchButton(page).click();
  await expect(searchInput(page)).toHaveValue(longQuery);
  await expect(visibleItems(page)).toHaveCount(0);
  await expect(emptyMessage(page)).toBeVisible();
  await report(page);
});

test('BOUNDARY: the Search button stays enabled and an empty query restores the full list', async ({ page }) => {
  await expect(searchButton(page)).toBeEnabled();
  await searchInput(page).fill('Jordan');
  await searchButton(page).click();
  await expect(visibleItems(page)).toHaveCount(1);
  await expect(visibleItems(page)).toHaveText(/Jordan Lee/);
  await searchInput(page).fill('');
  await expect(searchButton(page)).toBeEnabled();
  await searchButton(page).click();
  await expect(visibleItems(page)).toHaveCount(4);
  await expect(emptyMessage(page)).toBeHidden();
  await report(page);
});

test('SECURITY: a script payload in the search box is treated as inert plain text', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', async d => { dialogFired = true; await d.dismiss(); });
  const payload = '<script>alert(1)</script>';
  await searchInput(page).fill(payload);
  await searchButton(page).click();
  expect(dialogFired).toBe(false);
  await expect(searchInput(page)).toHaveValue(payload);
  await expect(page.locator('#team-list script, #team-empty-message script')).toHaveCount(0);
  await expect(emptyMessage(page)).toBeVisible();
  await searchInput(page).fill('Sam');
  await searchButton(page).click();
  await expect(visibleItems(page)).toHaveCount(1);
  await expect(visibleItems(page)).toHaveText(/Sam Okafor/);
  await report(page);
});