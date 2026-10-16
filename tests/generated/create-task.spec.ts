import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Logs in by itself, so it starts signed out (the run's shared session
// is for tests that start signed in).
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Journey: Create a new task on the Dashboard (dashboard/index.html).
 *
 * Evidence (source): the page is gated by
 *   if (localStorage.getItem('ttapp_logged_in') !== '1') -> ../login.html
 * The form is #add-task-form with label "Task name" for #task-title (type=text, REQUIRED,
 * no maxlength/minlength/pattern) and submit button #add-task-submit "Create Task".
 * Submitting trims the value, ignores an empty result, appends an <li class="list-item">
 * to #task-list, clears the input and hides/shows #task-empty-message ("No tasks yet.").
 * A #task-search box (label "Search tasks") filters the list on input and shows
 * #task-search-empty ("No task matches your search.") when nothing matches.
 * The list is DOM-only -- there is no data request and no paging control, so no request is
 * faked or delayed anywhere in this file.
 */

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return errors;
}

async function reportDiagnostics(page: Page, consoleErrors: string[]) {
  if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

/** The dashboard is gated, so reaching it requires a real session. */
async function loginAsUser(page: Page) {
  await page.goto('login.html', { waitUntil: 'domcontentloaded' });
  const username = page.getByRole('textbox', { name: 'Username' });
  await username.waitFor({ state: 'visible', timeout: 15000 });
  await username.fill(process.env.APP_USERNAME ?? 'demo');
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.APP_PASSWORD ?? 'demo123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('#login-message')).toContainText('Login successful', { timeout: 15000 });
  await page.waitForURL(/welcome\.html/, { timeout: 15000 });
}

async function openDashboard(page: Page) {
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Task name' })).toBeVisible({ timeout: 15000 });
}

test('POSITIVE: creating a new task with a valid title adds it to the task list', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  const taskTitle = `Task ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `task title: ${taskTitle}` });

  await loginAsUser(page);
  await openDashboard(page);

  // The two seeded tasks are present before we add ours.
  await expect(page.locator('#task-list li')).toHaveCount(2);

  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });
  await expect(createButton).toBeEnabled();

  await titleInput.fill(taskTitle);
  await createButton.click();

  const createdItem = page.locator('#task-list li').filter({ hasText: taskTitle });
  await expect(createdItem).toBeVisible({ timeout: 10000 });
  await expect(createdItem).toHaveAttribute('data-task', taskTitle);
  await expect(page.locator('#task-list li')).toHaveCount(3);

  // The form clears itself once the task is added.
  await expect(titleInput).toHaveValue('');

  // The visible result of the action: the new task as a real, removable list entry.
  await expect(createdItem).toMatchAriaSnapshot(`
  - listitem:
    - text: ${taskTitle}
    - button "Delete task"
  `);

  // The task list is DOM-only (no back-end and no reload persistence in the source), so the
  // list on this page IS the record view; re-assert it holds the value we typed.
  await expect(page.locator('#task-list')).toContainText(taskTitle);

  await reportDiagnostics(page, consoleErrors);
});

test('NEGATIVE: submitting the task form with an empty title is rejected and saves nothing', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  await loginAsUser(page);
  await openDashboard(page);

  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });

  await expect(titleInput).toHaveValue('');
  const before = await page.locator('#task-list li').count();

  await createButton.click();

  // #task-title is `required`, so the browser blocks the submit and shows its own message.
  expect(await titleInput.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
  expect(await titleInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).not.toBe('');

  // Nothing was saved: the same number of tasks and the form is still on screen.
  await expect(page.locator('#task-list li')).toHaveCount(before);
  await expect(page.locator('#add-task-form')).toBeVisible();
  await expect(page.locator('#task-list li[data-task=""]')).toHaveCount(0);

  // Reality check on the button: the app never disables it, it relies on native validation.
  await expect(createButton).toBeEnabled();

  await reportDiagnostics(page, consoleErrors);
});

test('VALIDATION: the required task title blocks submission with its own message', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  await loginAsUser(page);
  await openDashboard(page);

  // dashboard/index.html marks exactly one field as required: #task-title, label "Task name".
  const requiredFields = [
    { name: 'Task name', locator: page.getByRole('textbox', { name: 'Task name' }) },
  ];

  for (const field of requiredFields) {
    await field.locator.fill('');
    await expect(field.locator).toHaveValue('');

    const before = await page.locator('#task-list li').count();
    await page.getByRole('button', { name: 'Create Task' }).click();

    // The browser's own validation message for this specific required field.
    expect(await field.locator.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
    const message = await field.locator.evaluate((el) => (el as HTMLInputElement).validationMessage);
    expect(message.length).toBeGreaterThan(0);

    // The submission was blocked: no task was added.
    await expect(page.locator('#task-list li')).toHaveCount(before);
    await expect(page.locator('#add-task-form')).toBeVisible();

    // Refill so the next field in the loop is the only one missing a value.
    await field.locator.fill('placeholder value');
  }

  // The form also refuses a title that is nothing but whitespace (the handler trims it).
  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  await titleInput.fill('   ');
  const beforeWhitespace = await page.locator('#task-list li').count();
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.locator('#task-list li')).toHaveCount(beforeWhitespace);
  await expect(page.locator('#task-list li[data-task=""]')).toHaveCount(0);

  await reportDiagnostics(page, consoleErrors);
});

test('BOUNDARY: an extremely long task title is accepted and kept in full (no length limit declared)', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  const longTitle = 'B'.repeat(1000);
  test.info().annotations.push({ type: 'test-data', description: `long title length: ${longTitle.length}` });

  await loginAsUser(page);
  await openDashboard(page);

  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });

  // Real rule from the source: #task-title only carries `required` -- maxLength -1 means no limit,
  // so the extreme value is the generic one rather than a specific maxlength + 1.
  expect(await titleInput.evaluate((el) => (el as HTMLInputElement).maxLength)).toBe(-1);

  await titleInput.fill(longTitle);
  await expect(titleInput).toHaveValue(longTitle); // nothing is cut as it is typed
  await createButton.click();

  const created = page.locator('#task-list li').last();
  await expect(created).toHaveAttribute('data-task', longTitle);
  await expect(created.locator('span')).toHaveText(longTitle);
  await expect(titleInput).toHaveValue('');

  await reportDiagnostics(page, consoleErrors);
});

test('SECURITY: the dashboard requires a session, and script text typed as a title stays inert', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });

  // 1) Signed out, the gated dashboard must really send us to the sign-in form.
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/login\.html/, { timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0);
  await expect(page.locator('#task-list')).toHaveCount(0);

  // 2) Signed in, an unsafe title must be rendered as plain text only.
  await loginAsUser(page);
  await openDashboard(page);

  const payload = '<script>alert(1)</script>';
  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  await titleInput.fill(payload);
  await page.getByRole('button', { name: 'Create Task' }).click();

  const injected = page.locator('#task-list li').last();
  await expect(injected.locator('span')).toHaveText(payload);
  await expect(injected).toHaveAttribute('data-task', payload);
  await expect(page.locator('#task-list script')).toHaveCount(0);
  expect(dialogs).toHaveLength(0);

  await reportDiagnostics(page, consoleErrors);
});

test('STATE: removing every task shows the dashboard empty-state message', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  await loginAsUser(page);
  await openDashboard(page);

  const items = page.locator('#task-list li');
  await expect(items.first()).toBeVisible({ timeout: 10000 });
  const initialCount = await items.count();
  expect(initialCount).toBeGreaterThan(0);

  for (let i = 0; i < initialCount + 3; i++) {
    if ((await items.count()) === 0) break;
    await page.getByRole('button', { name: 'Delete task' }).filter({ visible: true }).first().click();
  }

  await expect(items).toHaveCount(0);
  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-empty-message')).toHaveText('No tasks yet.');

  await reportDiagnostics(page, consoleErrors);
});

test('STATE: ending the session and reloading the dashboard returns to the sign-in page', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  await loginAsUser(page);
  await openDashboard(page);
  await expect(page.locator('#task-list li').first()).toBeVisible({ timeout: 10000 });

  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForURL(/login\.html/, { timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.locator('#task-list')).toHaveCount(0);

  await reportDiagnostics(page, consoleErrors);
});

test('POSITIVE: the new Search tasks box filters the task list and reports when nothing matches', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackConsoleErrors(page);

  const taskTitle = `Searchable ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `task title: ${taskTitle}` });

  await loginAsUser(page);
  await openDashboard(page);

  // The two seeded tasks are present before we add ours.
  await expect(page.locator('#task-list li')).toHaveCount(2);

  // Add a task of our own so we are filtering over something this journey created.
  const titleInput = page.getByRole('textbox', { name: 'Task name' });
  await titleInput.fill(taskTitle);
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.locator('#task-list li')).toHaveCount(3);

  const searchInput = page.getByRole('searchbox', { name: 'Search tasks' });
  await expect(searchInput).toBeVisible();
  await expect(page.locator('#task-search-empty')).toBeHidden();

  // A matching query keeps the created task visible and hides the rest.
  await searchInput.fill('searchable');
  const createdItem = page.locator('#task-list li').filter({ hasText: taskTitle });
  await expect(createdItem).toBeVisible();
  await expect(page.locator('#task-list li').filter({ hasText: "Publish next week's shifts" })).toBeHidden();
  await expect(page.locator('#task-search-empty')).toBeHidden();

  // A non-matching query hides every task and shows the no-match message.
  await searchInput.fill('no-task-matches-this');
  await expect(createdItem).toBeHidden();
  await expect(page.locator('#task-search-empty')).toBeVisible();
  await expect(page.locator('#task-search-empty')).toHaveText('No task matches your search.');

  // Clearing the box restores the full list and hides the message again.
  await searchInput.fill('');
  await expect(createdItem).toBeVisible();
  await expect(page.locator('#task-search-empty')).toBeHidden();

  await reportDiagnostics(page, consoleErrors);
});