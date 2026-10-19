import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The dashboard is gated behind a localStorage flag (see dashboard/index.html).
// We seed that session flag from the login origin instead of using credentials.
async function openDashboardLoggedIn(page: Page) {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('ttapp_logged_in', '1');
    localStorage.setItem('ttapp_role', 'user');
  });
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });
}

function collectConsoleErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return consoleErrors;
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

const SORT_Z_A = /Sort Z[–\-]A/;
const descending = (values: string[]) => [...values].sort((a, b) => b.localeCompare(a));

test('POSITIVE: Sort Z–A reorders the dashboard tasks in reverse alphabetical order', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  const unique = Date.now();
  const zebraTask = `Zebra audit ${unique}`;
  const mangoTask = `Mango review ${unique}`;
  const appleTask = `Apple check ${unique}`;
  test.info().annotations.push({ type: 'test-data', description: `tasks: ${zebraTask} | ${mangoTask} | ${appleTask}` });

  await openDashboardLoggedIn(page);

  const taskTitle = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });
  const taskNames = page.locator('#task-list > li > span');
  const taskCount = page.locator('#task-count');

  // Baseline: the two tasks that ship with the page.
  await expect(taskNames).toHaveCount(2);
  await expect(taskCount).toHaveText('2 tasks on your list');

  // Ensure the list contains several tasks with different names, appended in a NON Z-A order.
  for (const name of [zebraTask, mangoTask, appleTask]) {
    await taskTitle.fill(name);
    await createButton.click();
    await expect(taskNames.filter({ hasText: name })).toHaveCount(1);
  }
  await expect(taskNames).toHaveCount(5);
  await expect(taskCount).toHaveText('5 tasks on your list');

  const before = (await taskNames.allTextContents()).map(t => t.trim());
  expect(before).toEqual([
    "Publish next week's shifts",
    'Approve pending time-off requests',
    zebraTask,
    mangoTask,
    appleTask,
  ]);
  // The list is genuinely NOT in descending order yet, so the next step must change it.
  expect(before).not.toEqual(descending(before));

  await page.getByRole('button', { name: SORT_Z_A }).click();

  const after = (await taskNames.allTextContents()).map(t => t.trim());
  expect(after).toEqual(descending(after));
  expect(after).toEqual([
    zebraTask,
    "Publish next week's shifts",
    mangoTask,
    'Approve pending time-off requests',
    appleTask,
  ]);

  // Sorting only reorders: nothing added, nothing removed.
  await expect(taskNames).toHaveCount(5);
  await expect(taskCount).toHaveText('5 tasks on your list');
  for (const name of [zebraTask, mangoTask, appleTask]) {
    await expect(taskNames.filter({ hasText: name })).toHaveCount(1);
  }

  await expect(page.getByRole('list')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - text: ${zebraTask}
      - listitem:
        - text: Publish next week's shifts
  `);

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('NEGATIVE: Sort Z–A on an empty task list adds no rows', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  await openDashboardLoggedIn(page);

  const rows = page.locator('#task-list > li');
  const emptyMessage = page.locator('#task-empty-message');
  const taskCount = page.locator('#task-count');

  await expect(rows).toHaveCount(2);

  // There is nothing to sort: remove the two seeded tasks through the UI.
  await page.locator('#task-list li').getByRole('button', { name: 'Delete task' }).filter({ visible: true }).first().click();
  await expect(rows).toHaveCount(1);
  await page.locator('#task-list li').getByRole('button', { name: 'Delete task' }).filter({ visible: true }).first().click();
  await expect(rows).toHaveCount(0);

  await expect(emptyMessage).toBeVisible();
  await expect(emptyMessage).toHaveText('No tasks yet.');
  await expect(taskCount).toHaveText('0 tasks on your list');

  await page.getByRole('button', { name: SORT_Z_A }).click();

  // The sort must be a no-op: no fabricated rows, no error, empty state intact.
  await expect(rows).toHaveCount(0);
  await expect(emptyMessage).toBeVisible();
  await expect(emptyMessage).toHaveText('No tasks yet.');
  await expect(taskCount).toHaveText('0 tasks on your list');
  await expect(page.getByRole('list')).toMatchAriaSnapshot('- list');

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('VALIDATION: Task name is required and whitespace-only names are rejected', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  await openDashboardLoggedIn(page);

  const taskTitle = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });
  const rows = page.locator('#task-list > li');

  await expect(rows).toHaveCount(2);

  const cases = [
    { label: 'empty', value: '', blockedByBrowser: true },
    { label: 'whitespace only', value: '   ', blockedByBrowser: false },
  ];

  for (const testCase of cases) {
    await taskTitle.fill(testCase.value);
    await createButton.click();

    const validity = await taskTitle.evaluate((el: HTMLInputElement) => ({
      valid: el.validity.valid,
      message: el.validationMessage,
    }));

    if (testCase.blockedByBrowser) {
      // The field is `required`, so the browser refuses the submit outright.
      expect(validity.valid).toBe(false);
      expect(validity.message).not.toBe('');
    } else {
      // The browser accepts spaces, but the page trims the value and drops it.
      expect(validity.valid).toBe(true);
    }

    // Nothing was saved in either case.
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#task-count')).toHaveText('2 tasks on your list');
    await expect(page.locator('#task-empty-message')).toBeHidden();
    await expect(taskTitle).toHaveValue(testCase.value);
  }

  // A real name still works after the rejected attempts.
  const validName = `Valid task ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `task: ${validName}` });
  await taskTitle.fill(validName);
  await createButton.click();
  await expect(rows).toHaveCount(3);
  await expect(rows.locator('span').filter({ hasText: validName })).toHaveCount(1);

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('BOUNDARY: Task name has no maxlength — 1 and 500 characters are kept in full', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  await openDashboardLoggedIn(page);

  const taskTitle = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });
  const rows = page.locator('#task-list > li');
  const taskNames = page.locator('#task-list > li > span');

  // Real rules found in the source: the input is `required` and has no length limits.
  await expect(taskTitle).toHaveAttribute('required', '');
  expect(await taskTitle.getAttribute('maxlength')).toBeNull();
  expect(await taskTitle.getAttribute('minlength')).toBeNull();
  expect(await taskTitle.getAttribute('pattern')).toBeNull();

  await expect(rows).toHaveCount(2);

  const unique = Date.now();
  const oneChar = 'Q'; // 1 non-space character: the shortest valid name (required = at least 1 char)
  const longName = `Boundary ${unique} ${'A'.repeat(480)}`; // 500 characters: no maxlength rule to hit
  test.info().annotations.push({ type: 'test-data', description: `boundary lengths: ${oneChar.length}, ${longName.length}` });

  let expectedCount = 2;
  for (const name of [oneChar, longName]) {
    await taskTitle.fill(name);
    await createButton.click();
    expectedCount += 1;
    await expect(rows).toHaveCount(expectedCount);

    const created = rows.last();
    await expect(created.locator('span')).toHaveText(name);
    // The value is stored exactly as typed - not truncated, not rejected.
    expect(await created.getAttribute('data-task')).toBe(name);
    expect((await created.getAttribute('data-task'))!.length).toBe(name.length);
  }

  // The long name survives sorting unchanged.
  await page.getByRole('button', { name: SORT_Z_A }).click();
  await expect(rows).toHaveCount(4);
  const longRow = rows.filter({ hasText: `Boundary ${unique}` });
  await expect(longRow).toHaveCount(1);
  expect(await longRow.getAttribute('data-task')).toBe(longName);

  const after = (await taskNames.allTextContents()).map(t => t.trim());
  expect(after).toEqual(descending(after));

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('SECURITY: Dashboard redirects to login when signed out and script text renders inert', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  // 1) Signed out, the dashboard must not be reachable.
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/login\.html/, { timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0);

  // 2) Unsafe text typed into the task name must stay inert plain text.
  await openDashboardLoggedIn(page);

  const dialogs: string[] = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });

  const payload = '<script>alert(1)</script>';
  await page.getByRole('textbox', { name: 'Task name' }).fill(payload);
  await page.getByRole('button', { name: 'Create Task' }).click();

  const row = page.locator('#task-list > li').filter({ hasText: '<script>alert(1)</script>' });
  await expect(row).toHaveCount(1);
  await expect(row.locator('span')).toHaveText(payload);

  // No script element was created and no alert dialog fired.
  expect(await page.locator('#task-list script').count()).toBe(0);
  expect(await row.locator('script').count()).toBe(0);
  expect(dialogs).toEqual([]);

  // Page is still intact and usable.
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: SORT_Z_A }).click();
  await expect(row).toHaveCount(1);

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('STATE: Empty task list shows the real "No tasks yet." message', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  await openDashboardLoggedIn(page);

  const rows = page.locator('#task-list > li');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#task-empty-message')).toBeHidden();

  // 'Clear all tasks' asks for confirmation first.
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear all tasks' }).click();

  await expect(rows).toHaveCount(0);
  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-empty-message')).toHaveText('No tasks yet.');
  await expect(page.locator('#task-count')).toHaveText('0 tasks on your list');

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});

test('STATE: Session ended — reload without stored login shows the sign-in form', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectConsoleErrors(page);

  await openDashboardLoggedIn(page);
  await expect(page.locator('#task-list > li')).toHaveCount(2);

  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForURL(/login\.html/, { timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0);

  await scanAccessibility(page);
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
});