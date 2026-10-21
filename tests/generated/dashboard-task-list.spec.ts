import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DASHBOARD_PATH = 'dashboard/index.html';
const TASK_A = "Publish next week's shifts";
const TASK_B = 'Approve pending time-off requests';

// Capture console errors, page errors, failed requests and HTTP error responses.
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req =>
    errors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`),
  );
  page.on('response', res => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return errors;
}

async function reportConsoleErrors(errors: string[]) {
  if (errors.length) {
    test.info().annotations.push({
      type: 'console-errors',
      description: errors.slice(0, 5).join(' | '),
    });
  }
}

async function scanAccessibility(page: Page) {
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

/**
 * The dashboard guards itself on localStorage key `ttapp_logged_in === '1'`
 * (dashboard/index.html). We establish that real session flag from the login
 * page's own origin instead of typing credentials, then navigate to the page
 * under test the way a returning user would.
 */
async function signInViaSession(page: Page) {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    window.localStorage.setItem('ttapp_logged_in', '1');
    window.localStorage.setItem('ttapp_role', 'user');
  });
}

async function openDashboardSignedIn(page: Page) {
  await signInViaSession(page);
  await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });
}

test('POSITIVE: Dashboard shows the task list for a signed-in user', async ({ page }) => {
  const consoleErrors = watchForErrors(page);

  await openDashboardSignedIn(page);

  const taskItems = page.locator('#task-list .list-item');
  await expect(taskItems).toHaveCount(2, { timeout: 15000 });

  const firstTask = taskItems.filter({ hasText: TASK_A });
  await expect(firstTask).toBeVisible();
  await expect(firstTask).toContainText(TASK_A);
  await expect(firstTask.getByRole('button', { name: 'Delete task' })).toBeVisible();

  const secondTask = taskItems.filter({ hasText: TASK_B });
  await expect(secondTask).toBeVisible();
  await expect(secondTask).toContainText(TASK_B);

  // The count line is derived from the real number of rendered rows.
  await expect(page.locator('#task-count')).toHaveText('2 tasks on your list');
  // The empty state must NOT be showing while tasks exist.
  await expect(page.locator('#task-empty-message')).toBeHidden();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Dashboard" [level=1]
    - button "Add Task"
    - button "Clear filter"
  `);

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});

test.describe('signed-out visitor', () => {
  // This scenario needs a genuinely empty saved session, unlike the rest of the file.
  test.use({ storageState: { cookies: [], origins: [] } });

test('NEGATIVE: Dashboard is blocked for a signed-out visitor', async ({ page }) => {
  const consoleErrors = watchForErrors(page);

  // Straight to the protected page with no session at all.
  await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });

  await page.waitForURL(url => url.pathname.includes('login.html'), { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible({ timeout: 15000 });

  // The real sign-in form is what the visitor gets instead of the dashboard.
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();

  // None of the dashboard's protected content leaked through.
  await expect(page.locator('#task-list')).toHaveCount(0);
  await expect(page.getByText(TASK_A)).toHaveCount(0);
  await expect(page.getByText(TASK_B)).toHaveCount(0);

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});
});

test('BOUNDARY: Filter box accepts an extreme query and narrows the list', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = watchForErrors(page);

  await openDashboardSignedIn(page);

  const filter = page.getByRole('searchbox', { name: 'Filter tasks' });
  await expect(filter).toBeVisible({ timeout: 15000 });
  const taskItems = page.locator('#task-list .list-item');
  await expect(taskItems).toHaveCount(2);

  // No maxlength/pattern rule exists on the filter input, so an extreme
  // 1000-character query is the right way to probe its real behaviour.
  const longQuery = 'q'.repeat(1000);
  await filter.fill(longQuery);

  // Observed behaviour: the value is kept exactly as typed (not truncated).
  await expect(filter).toHaveValue(longQuery);
  const emptyNotice = page.locator('#task-search-empty');
  await expect(emptyNotice).toBeVisible();
  await expect(emptyNotice).toHaveText(`No tasks match "${longQuery}".`);
  await expect(taskItems.first()).toBeHidden();

  // Clearing the filter brings every row back -- the extreme value broke nothing.
  await page.getByRole('button', { name: 'Clear filter' }).click();
  await expect(filter).toHaveValue('');
  await expect(taskItems.filter({ hasText: TASK_A })).toBeVisible();
  await expect(taskItems.filter({ hasText: TASK_B })).toBeVisible();

  // A narrow query hides only the non-matching row and leaves the count alone.
  await filter.fill('week');
  await expect(taskItems.filter({ hasText: TASK_A })).toBeVisible();
  await expect(taskItems.filter({ hasText: TASK_B })).toBeHidden();
  await expect(page.locator('#task-count')).toHaveText('2 tasks on your list');

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});

test('SECURITY: Unsafe text in the filter box renders as inert plain text', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = watchForErrors(page);

  await openDashboardSignedIn(page);

  let dialogShown = false;
  page.on('dialog', async dialog => {
    dialogShown = true;
    await dialog.dismiss();
  });

  const payload = '<script>alert(1)</script>';
  const filter = page.getByRole('searchbox', { name: 'Filter tasks' });
  await filter.fill(payload);

  const emptyNotice = page.locator('#task-search-empty');
  await expect(emptyNotice).toBeVisible({ timeout: 15000 });
  // The payload is echoed back as literal text, not parsed as markup.
  await expect(emptyNotice).toHaveText(`No tasks match "${payload}".`);
  await expect(emptyNotice).toContainText('<script>alert(1)</script>');
  await expect(emptyNotice.locator('script')).toHaveCount(0);

  // Nothing executed and the dashboard is still intact.
  expect(dialogShown).toBe(false);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.locator('#task-count')).toHaveText('2 tasks on your list');

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});

test('STATE: Empty task list shows the "No tasks yet." message', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = watchForErrors(page);

  await openDashboardSignedIn(page);
  await expect(page.locator('#task-list .list-item')).toHaveCount(2);
  await expect(page.locator('#task-empty-message')).toBeHidden();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear all tasks' }).click();

  const taskItems = page.locator('#task-list .list-item');
  await expect(taskItems).toHaveCount(0);
  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-empty-message')).toHaveText('No tasks yet.');
  await expect(page.locator('#task-count')).toHaveText('0 tasks on your list');

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});

test('STATE: Ending the session returns the user to the sign-in page', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = watchForErrors(page);

  await openDashboardSignedIn(page);
  await expect(page.locator('#task-list .list-item').first()).toBeVisible({ timeout: 15000 });

  // Simulate the session ending underneath the user.
  await page.context().clearCookies();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForURL(url => url.pathname.includes('login.html'), { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  // Not an error page and not a broken half-rendered dashboard.
  await expect(page.locator('#task-list')).toHaveCount(0);
  await expect(page.getByText(TASK_A)).toHaveCount(0);

  await scanAccessibility(page);
  await reportConsoleErrors(consoleErrors);
});