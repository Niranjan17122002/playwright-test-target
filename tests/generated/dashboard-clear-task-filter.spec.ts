import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Journey: reset the Dashboard task filter with the 'Clear filter' button.
const DASHBOARD_PATH = 'dashboard/index.html';
const TASK_ONE = "Publish next week's shifts";
const TASK_TWO = 'Approve pending time-off requests';

function watchPage(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', err => problems.push(err.message));
  page.on('requestfailed', req =>
    problems.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`),
  );
  page.on('response', res => {
    if (res.status() >= 400) problems.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return problems;
}

async function reportDiagnostics(page: Page, problems: string[]): Promise<void> {
  if (problems.length) {
    test.info().annotations.push({ type: 'console-errors', description: problems.slice(0, 5).join(' | ') });
  }
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });
}

function taskItems(page: Page) {
  return page.getByRole('listitem');
}

function filterBox(page: Page) {
  return page.getByRole('searchbox', { name: 'Filter tasks' });
}

function clearFilterButton(page: Page) {
  return page.getByRole('button', { name: 'Clear filter' });
}

function noResultsMessage(page: Page) {
  return page.getByText(/No tasks? match/i).first();
}

test('POSITIVE: Clear filter empties the Filter tasks box and restores both tasks', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = watchPage(page);

  await openDashboard(page);

  const search = filterBox(page);
  const items = taskItems(page);
  const publishTask = items.filter({ hasText: TASK_ONE });
  const approveTask = items.filter({ hasText: TASK_TWO });

  await expect(search).toBeVisible({ timeout: 15000 });
  await expect(search).toHaveValue('');
  await expect(items).toHaveCount(2);
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeVisible();

  // Narrow the list with the filter.
  await search.fill('publish');
  await expect(search).toHaveValue('publish');
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeHidden();

  // One click on 'Clear filter' must empty the box and restore the full list.
  await clearFilterButton(page).click();

  await expect(search).toHaveValue('');
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeVisible();
  await expect(noResultsMessage(page)).toBeHidden();
  await expect(page.getByText('2 tasks on your list')).toBeVisible();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
  - heading "Dashboard"
  - searchbox "Filter tasks"
  - button "Clear filter"
  `);

  await reportDiagnostics(page, consoleErrors);
});

test('NEGATIVE: a filter term matching no task shows the no-results message instead of hiding tasks silently', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = watchPage(page);

  const unmatchedTerm = `zzz-no-match-${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `unmatched filter term: ${unmatchedTerm}` });

  await openDashboard(page);

  const search = filterBox(page);
  const items = taskItems(page);
  await expect(items).toHaveCount(2);

  await search.fill(unmatchedTerm);
  await expect(search).toHaveValue(unmatchedTerm);

  // Nothing matches: the app must say so and must not remove or save anything.
  await expect(noResultsMessage(page)).toBeVisible({ timeout: 10000 });
  await expect(items.filter({ hasText: TASK_ONE })).toBeHidden();
  await expect(items.filter({ hasText: TASK_TWO })).toBeHidden();
  await expect(items).toHaveCount(2);
  await expect(page.getByText('2 tasks on your list')).toBeVisible();

  // Clear filter recovers from the empty result set.
  await clearFilterButton(page).click();
  await expect(search).toHaveValue('');
  await expect(items.filter({ hasText: TASK_ONE })).toBeVisible();
  await expect(items.filter({ hasText: TASK_TWO })).toBeVisible();
  await expect(noResultsMessage(page)).toBeHidden();

  await reportDiagnostics(page, consoleErrors);
});

test('VALIDATION: a whitespace-only filter is trimmed and treated as no filter', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = watchPage(page);

  await openDashboard(page);

  const search = filterBox(page);
  const items = taskItems(page);
  await expect(items).toHaveCount(2);

  // The filter value is trimmed before matching, so spaces must not hide anything.
  await search.fill('   ');
  await expect(search).toHaveValue('   ');
  await expect(items.filter({ hasText: TASK_ONE })).toBeVisible();
  await expect(items.filter({ hasText: TASK_TWO })).toBeVisible();
  await expect(noResultsMessage(page)).toBeHidden();

  await clearFilterButton(page).click();
  await expect(search).toHaveValue('');
  await expect(items.filter({ hasText: TASK_ONE })).toBeVisible();
  await expect(items.filter({ hasText: TASK_TWO })).toBeVisible();

  await reportDiagnostics(page, consoleErrors);
});

test('BOUNDARY: filter accepts a 500-character value verbatim and an empty value shows every task', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = watchPage(page);

  // The 'Filter tasks' search input has no maxLength/pattern restriction in the source,
  // so an extreme 500-character value is the generic boundary probe for this field.
  const longValue = 'a'.repeat(500);
  test.info().annotations.push({ type: 'test-data', description: `boundary filter length: ${longValue.length}` });

  await openDashboard(page);

  const search = filterBox(page);
  const items = taskItems(page);
  const publishTask = items.filter({ hasText: TASK_ONE });
  const approveTask = items.filter({ hasText: TASK_TWO });
  await expect(items).toHaveCount(2);

  await search.fill(longValue);
  await expect(search).toHaveValue(longValue);
  expect((await search.inputValue()).length).toBe(500);
  await expect(publishTask).toBeHidden();
  await expect(approveTask).toBeHidden();
  await expect(noResultsMessage(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

  // Zero-length value: no filtering at all.
  await search.fill('');
  await expect(search).toHaveValue('');
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeVisible();
  await expect(noResultsMessage(page)).toBeHidden();

  // Exact full task name narrows to exactly that task.
  await search.fill(TASK_ONE);
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeHidden();

  await clearFilterButton(page).click();
  await expect(search).toHaveValue('');
  await expect(items).toHaveCount(2);
  await expect(publishTask).toBeVisible();
  await expect(approveTask).toBeVisible();

  await reportDiagnostics(page, consoleErrors);
});

test('SECURITY: script markup typed into the filter stays inert plain text', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = watchPage(page);

  let dialogFired = false;
  page.on('dialog', async dialog => {
    dialogFired = true;
    await dialog.dismiss();
  });

  const payload = '<script>alert(1)</script>';
  test.info().annotations.push({ type: 'test-data', description: `unsafe filter payload: ${payload}` });

  await openDashboard(page);

  const search = filterBox(page);
  const items = taskItems(page);
  await expect(items).toHaveCount(2);

  await search.fill(payload);
  await expect(search).toHaveValue(payload);

  // No script execution, no injected element, page and tasks intact.
  await page.waitForTimeout(500);
  expect(dialogFired).toBe(false);
  expect(await page.locator('script:has-text("alert(1)")').count()).toBe(0);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(items).toHaveCount(2);

  await clearFilterButton(page).click();
  await expect(search).toHaveValue('');
  await expect(items.filter({ hasText: TASK_ONE })).toBeVisible();
  await expect(items.filter({ hasText: TASK_TWO })).toBeVisible();

  await reportDiagnostics(page, consoleErrors);
});

test.describe('Dashboard requires an active session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SECURITY: the Dashboard is not reachable without an active session', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/login\.html/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeHidden();
    await expect(page.getByRole('searchbox', { name: 'Filter tasks' })).toBeHidden();

    await reportDiagnostics(page, consoleErrors);
  });
});