import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The Dashboard (dashboard/index.html) is gated behind the app's own session flag
 * (`localStorage.ttapp_logged_in === '1'`); without it the page redirects to login.html.
 * We set that flag exactly the way the app's own login handler does, so these tests
 * exercise the dashboard's search/filter flow without going through the login form.
 */
async function openDashboard(page: Page): Promise<void> {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('ttapp_logged_in', '1'));
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

const SEARCH_EMPTY_TEXT = 'No task matches your search.';

function attachDiagnostics(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return consoleErrors;
}

async function reportDiagnostics(page: Page, consoleErrors: string[]): Promise<void> {
  if (consoleErrors.length) {
    test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  }
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

test('POSITIVE: searching the dashboard filters the task list to matching tasks', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);

  const search = page.getByLabel('Filter tasks');
  const shiftsTask = page.locator('#task-list li').filter({ hasText: 'Publish next week' });
  const approveTask = page.locator('#task-list li').filter({ hasText: 'Approve pending' });
  const emptyMessage = page.locator('#task-search-empty');

  // Both seeded tasks are visible before filtering.
  await expect(shiftsTask).toBeVisible();
  await expect(approveTask).toBeVisible();

  // Filtering is case-insensitive: 'SHIFTS' keeps only "Publish next week's shifts".
  await search.fill('SHIFTS');
  await expect(shiftsTask).toBeVisible();
  await expect(approveTask).toBeHidden();
  await expect(emptyMessage).toBeHidden();
  await expect(page.locator('#task-list li:visible')).toHaveCount(1);

  // Result area: the dashboard heading and its filter box remain, with the filtered list shown.
  await expect(page.locator('main')).toMatchAriaSnapshot(`
    - heading "Dashboard"
    - searchbox "Filter tasks"
  `);

  // Clearing the filter restores every task.
  await search.fill('');
  await expect(shiftsTask).toBeVisible();
  await expect(approveTask).toBeVisible();
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);
  await expect(emptyMessage).toBeHidden();

  await reportDiagnostics(page, consoleErrors);
});

test('POSITIVE: the Sort by name button reorders the task list alphabetically by task name', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);

  const listItems = page.locator('#task-list li');

  // Before sorting, the list is in insertion order: "Publish..." precedes "Approve...".
  await expect(listItems.first()).toHaveAttribute('data-task', "Publish next week's shifts");
  await expect(listItems.nth(1)).toHaveAttribute('data-task', 'Approve pending time-off requests');

  // The renamed button still carries the same id and is labelled "Sort by name".
  await expect(page.getByRole('button', { name: 'Sort by name' })).toBeVisible();
  await page.locator('#sort-tasks').click();

  // Sorting by name moves "Approve pending time-off requests" ahead of "Publish next week's shifts".
  await expect(listItems.first()).toHaveAttribute('data-task', 'Approve pending time-off requests');
  await expect(listItems.nth(1)).toHaveAttribute('data-task', "Publish next week's shifts");
  await expect(listItems).toHaveCount(2);

  await reportDiagnostics(page, consoleErrors);
});

test('POSITIVE: the Sort Z–A button reorders the task list in reverse alphabetical order', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);

  const listItems = page.locator('#task-list li');

  // Sort by name first, so the reverse sort has a visible effect on the order.
  await page.locator('#sort-tasks').click();
  await expect(listItems.first()).toHaveAttribute('data-task', 'Approve pending time-off requests');
  await expect(listItems.nth(1)).toHaveAttribute('data-task', "Publish next week's shifts");

  await expect(page.getByRole('button', { name: 'Sort Z–A' })).toBeVisible();
  await page.locator('#sort-tasks-reverse').click();

  // Z–A moves "Publish next week's shifts" ahead of "Approve pending time-off requests".
  await expect(listItems.first()).toHaveAttribute('data-task', "Publish next week's shifts");
  await expect(listItems.nth(1)).toHaveAttribute('data-task', 'Approve pending time-off requests');
  await expect(listItems).toHaveCount(2);

  await reportDiagnostics(page, consoleErrors);
});

test('NEGATIVE: a search term with no match shows the empty message and hides all tasks', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);

  const search = page.getByLabel('Filter tasks');
  const emptyMessage = page.locator('#task-search-empty');

  // The no-match message is not displayed until a non-matching term is typed.
  await expect(emptyMessage).toBeHidden();

  await search.fill('zzz-no-such-task-xyz');
  await expect(emptyMessage).toBeVisible();
  await expect(emptyMessage).toHaveText(SEARCH_EMPTY_TEXT);

  // No task matches, so none stays visible, and nothing was added or removed from the list.
  await expect(page.locator('#task-list li:visible')).toHaveCount(0);
  await expect(page.locator('#task-list li')).toHaveCount(2);

  await expect(page.locator('main')).toMatchAriaSnapshot(`
    - heading "Dashboard"
    - searchbox "Filter tasks"
    - paragraph: No task matches your search.
  `);

  // Clearing the term returns to the full, unfiltered list and hides the message again.
  await search.fill('');
  await expect(emptyMessage).toBeHidden();
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);

  await reportDiagnostics(page, consoleErrors);
});

test('BOUNDARY: the search box has no length limit and treats whitespace-only input as empty', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);

  const search = page.getByLabel('Filter tasks');
  const emptyMessage = page.locator('#task-search-empty');

  // The filter input is type="search" with no maxLength/minLength/pattern rule,
  // so an extreme 500-character term is kept exactly as typed (not truncated).
  const longTerm = 'a'.repeat(500);
  await search.fill(longTerm);
  await expect(search).toHaveValue(longTerm);
  // ...and because no task contains it, the no-match message is shown.
  await expect(emptyMessage).toBeVisible();
  await expect(page.locator('#task-list li:visible')).toHaveCount(0);

  // A term equal to a task's whole data-task value matches exactly that one task.
  await search.fill("Publish next week's shifts");
  await expect(page.locator('#task-list li:visible')).toHaveCount(1);
  await expect(emptyMessage).toBeHidden();

  // Whitespace-only input is trimmed to an empty query, so every task is shown again.
  await search.fill('   ');
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);
  await expect(emptyMessage).toBeHidden();

  await reportDiagnostics(page, consoleErrors);
});

test('SECURITY: an unsafe search string is not executed and leaves the task list intact', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });

  await openDashboard(page);

  const search = page.getByLabel('Filter tasks');
  const payload = '<script>alert(1)</script>';

  await search.fill(payload);

  // The payload is treated as inert plain text - it is never parsed as markup.
  await expect(search).toHaveValue(payload);
  await expect(page.locator('#task-list script')).toHaveCount(0);
  await expect(page.locator('#task-list li')).toHaveCount(2);
  await expect(page.getByText('<script>alert(1)</script>')).toHaveCount(0);
  // No task matches the payload, so the empty message shows as normal.
  await expect(page.locator('#task-search-empty')).toBeVisible();
  // Nothing executed while typing or filtering.
  expect(dialogs).toEqual([]);

  await reportDiagnostics(page, consoleErrors);
});

test('STATE: ending the session redirects the dashboard to the sign-in page', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = attachDiagnostics(page);

  await openDashboard(page);
  await expect(page.getByLabel('Filter tasks')).toBeVisible();

  // End the session the same way the app's own logout handler does, then reload the dashboard.
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });

  // The dashboard must no longer render; it sends the visitor to the real sign-in page.
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);

  await reportDiagnostics(page, consoleErrors);
});