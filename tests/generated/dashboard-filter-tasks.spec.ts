import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TASK_SHIFTS = "Publish next week's shifts";
const TASK_TIMEOFF = 'Approve pending time-off requests';
const NO_MATCH_MESSAGE = 'No task matches your search.';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return errors;
}

function taskRow(page: Page, title: string) {
  return page.locator('#task-list li').filter({ hasText: title });
}

async function scanA11y(page: Page): Promise<void> {
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });

  await Promise.race([
    page.locator('#task-search').waitFor({ state: 'visible', timeout: 15000 }),
    page.locator('#login-form').waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (await page.locator('#login-form').isVisible()) {
    // The dashboard gates itself on localStorage('ttapp_logged_in'); if the saved
    // session was not recognised, sign in once through the real login form.
    await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();
    await page.waitForURL(url => !url.toString().includes('login'), { timeout: 15000 });
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  }

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#task-search')).toBeVisible({ timeout: 15000 });
}

test('POSITIVE: filtering the task list with a matching term shows only matching tasks', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);
  const search = page.locator('#task-search');
  const emptyMsg = page.locator('#task-search-empty');

  // Baseline: both real tasks are listed and no empty-search message is shown.
  await expect(page.locator('#task-list li')).toHaveCount(2);
  await expect(taskRow(page, TASK_SHIFTS)).toBeVisible();
  await expect(taskRow(page, TASK_TIMEOFF)).toBeVisible();
  await expect(emptyMsg).toBeHidden();

  // The journey's own action: type part of an existing task name into 'Filter tasks'.
  await search.fill('shift');

  await expect(taskRow(page, TASK_SHIFTS)).toBeVisible();
  await expect(taskRow(page, TASK_TIMEOFF)).toBeHidden();
  await expect(page.locator('#task-list li:visible')).toHaveCount(1);
  await expect(emptyMsg).toBeHidden();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Dashboard"
    - searchbox "Filter tasks"
  `);

  // Clearing the filter brings every task back.
  await search.fill('');
  await expect(taskRow(page, TASK_SHIFTS)).toBeVisible();
  await expect(taskRow(page, TASK_TIMEOFF)).toBeVisible();
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);
  await expect(emptyMsg).toBeHidden();

  await scanA11y(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('NEGATIVE: a search term that matches no task shows the real empty message and hides every task', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  const noMatchQuery = `no-such-task-${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `no-match query: ${noMatchQuery}` });

  await openDashboard(page);
  const search = page.locator('#task-search');
  const emptyMsg = page.locator('#task-search-empty');

  await search.fill(noMatchQuery);

  // The app's own wording, straight from the page source.
  await expect(emptyMsg).toBeVisible();
  await expect(emptyMsg).toHaveText(NO_MATCH_MESSAGE);
  await expect(page.locator('#task-list li:visible')).toHaveCount(0);

  // Nothing was created or removed: the underlying list still holds both tasks.
  await expect(page.locator('#task-list li')).toHaveCount(2);

  // Clearing the query restores the full list and hides the message again.
  await search.fill('');
  await expect(emptyMsg).toBeHidden();
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);

  await scanA11y(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('BOUNDARY: the filter keeps an extreme 500-character query and treats whitespace-only input as empty', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);
  const search = page.locator('#task-search');
  const emptyMsg = page.locator('#task-search-empty');

  // Rule 1: the source declares #task-search with no maxlength/minlength attribute,
  // so any length is kept exactly as typed and simply matches nothing.
  const longQuery = 'x'.repeat(500);
  await search.fill(longQuery);
  await expect(search).toHaveValue(longQuery);
  await expect(emptyMsg).toBeVisible();
  await expect(emptyMsg).toHaveText(NO_MATCH_MESSAGE);
  await expect(page.locator('#task-list li:visible')).toHaveCount(0);

  // Rule 2: the filter trims whitespace (search.value.trim()), so spaces alone mean "no query":
  // the spaces stay in the box, but every task is shown and no message appears.
  const spacesOnly = ' '.repeat(10);
  await search.fill(spacesOnly);
  await expect(search).toHaveValue(spacesOnly);
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);
  await expect(emptyMsg).toBeHidden();

  // Rule 3: matching is case-insensitive (toLowerCase() on both sides).
  await search.fill('SHIFT');
  await expect(taskRow(page, TASK_SHIFTS)).toBeVisible();
  await expect(page.locator('#task-list li:visible')).toHaveCount(1);
  await expect(emptyMsg).toBeHidden();

  await scanA11y(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('SECURITY: unsafe markup typed into the filter stays inert plain text and never executes', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  let dialogMessage: string | null = null;
  page.on('dialog', async d => { dialogMessage = d.message(); await d.dismiss(); });

  await openDashboard(page);
  const search = page.locator('#task-search');
  const emptyMsg = page.locator('#task-search-empty');

  const payload = '<script>alert(1)</script>';
  await search.fill(payload);

  // The value is stored verbatim in the field and never rendered as markup anywhere.
  await expect(search).toHaveValue(payload);
  await expect(page.locator('#task-list script')).toHaveCount(0);
  await expect(page.locator('script', { hasText: 'alert(1)' })).toHaveCount(0);
  await expect(emptyMsg).toBeVisible();
  await expect(emptyMsg).toHaveText(NO_MATCH_MESSAGE);
  expect(dialogMessage).toBeNull();

  await scanA11y(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('STATE: a filtered list stays filtered after sorting and shows every task again when cleared', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);
  const search = page.locator('#task-search');

  await search.fill('time-off');
  await expect(taskRow(page, TASK_TIMEOFF)).toBeVisible();
  await expect(taskRow(page, TASK_SHIFTS)).toBeHidden();

  // Re-rendering the list (A-Z sort re-appends the same nodes) must not undo the filter.
  await page.getByRole('button', { name: /Sort A.Z/ }).click();
  await expect(taskRow(page, TASK_TIMEOFF)).toBeVisible();
  await expect(taskRow(page, TASK_SHIFTS)).toBeHidden();
  await expect(page.locator('#task-list li:visible')).toHaveCount(1);

  await search.fill('');
  await expect(page.locator('#task-list li:visible')).toHaveCount(2);
  // After sorting A-Z, 'Approve...' comes before 'Publish...'.
  await expect(page.locator('#task-list li').first()).toHaveAttribute('data-task', TASK_TIMEOFF);
  await expect(page.locator('#task-list li').last()).toHaveAttribute('data-task', TASK_SHIFTS);

  await scanA11y(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test.describe('dashboard without a session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SECURITY: the dashboard is blocked for a signed-out visitor and the sign-in form is shown', async ({ page }) => {
    test.setTimeout(60000);
    const consoleErrors = trackErrors(page);

    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });

    // The page's own gate redirects to the sign-in page instead of showing the task list.
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-submit')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.locator('#task-search')).toHaveCount(0);

    await scanA11y(page);
    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  });
});