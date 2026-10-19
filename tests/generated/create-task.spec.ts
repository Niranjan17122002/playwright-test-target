import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Collects console errors / page errors / failed requests / HTTP >= 400 responses
 * so a human can see them as an annotation (never as a hard failure).
 */
function watchPage(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('requestfailed', (req) =>
    consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`),
  );
  page.on('response', (res) => {
    if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return consoleErrors;
}

/** Non-blocking reporting: console/network noise + axe-core scan of the settled page. */
async function finish(page: Page, consoleErrors: string[]): Promise<void> {
  if (consoleErrors.length) {
    test.info().annotations.push({
      type: 'console-errors',
      description: consoleErrors.slice(0, 5).join(' | '),
    });
  }
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map((v) => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

/**
 * The Dashboard is protected by an inline script that sends visitors without the
 * 'ttapp_logged_in' localStorage flag to login.html. The suite normally starts signed
 * in; if the saved session is missing the app bounces us to the login page, so sign in
 * once with the project credentials and come back.
 */
async function openDashboard(page: Page): Promise<void> {
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });

  const bouncedToLogin = await page
    .getByRole('heading', { name: 'Login' })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true, () => false);

  if (bouncedToLogin) {
    await page.locator('#username').fill(process.env.APP_USERNAME ?? '');
    await page.locator('#password').fill(process.env.APP_PASSWORD ?? '');
    await page.locator('#login-submit').click();
    await page.waitForURL((url) => !url.toString().includes('login.html'), { timeout: 15000 });
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  }

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#task-list')).toBeVisible({ timeout: 15000 });
}

test.describe('Dashboard task creation', () => {
  test('POSITIVE: a task is created from the Dashboard and appended with an updated counter', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await openDashboard(page);

    const taskName = `Review roster ${Date.now()}`;
    test.info().annotations.push({ type: 'test-data', description: `taskName: ${taskName}` });

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const input = page.getByRole('textbox', { name: 'Task name' });
    const createButton = page.getByRole('button', { name: 'Create Task' });

    // Baseline: the dashboard ships with two seeded tasks.
    await expect(list.locator('li')).toHaveCount(2);
    await expect(taskCount).toHaveText('2 tasks');

    await input.fill(taskName);
    await createButton.click();

    // The new item is really in the list: appended at the bottom, with the typed text.
    await expect(list.locator('li')).toHaveCount(3);
    await expect(list.locator('li').last().locator('span')).toHaveText(taskName);
    await expect(taskCount).toHaveText('3 tasks');
    await expect(page.locator('#task-empty-message')).toBeHidden();
    await expect(input).toHaveValue('');

    // One short ARIA check of the result area (never an empty template).
    await expect(page.getByRole('main')).toMatchAriaSnapshot(`
      - heading "Dashboard" [level=1]
      - text: Task name
      - textbox "Task name":
        - /placeholder: e.g. Review roster
      - button "Create Task"
      - text: Filter tasks
      - searchbox "Filter tasks"
      - button "Sort A–Z"
      - list:
        - listitem:
          - text: Publish next week's shifts
          - button "Delete task"
        - listitem:
          - text: Approve pending time-off requests
          - button "Delete task"
        - listitem:
          - text: ${taskName}
          - button "Delete task"
      - paragraph:
        - link "Log out":
          - /url: "#"
    `);

    // The task list is client-side only (no server round-trip), so the list above is the
    // persistence proof for this journey -- reloading would reset it to the two seeded rows.
    await expect(list.locator('li').last().locator('span')).toHaveText(taskName);

    await finish(page, consoleErrors);
  });

  test('NEGATIVE: a whitespace-only task name is not accepted', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await openDashboard(page);

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const input = page.getByRole('textbox', { name: 'Task name' });
    const createButton = page.getByRole('button', { name: 'Create Task' });

    // Reality check on the primary action: this app never disables it, even when empty.
    await expect(createButton).toBeEnabled();

    await input.fill('   ');
    await createButton.click();

    // The handler trims the value and returns early: nothing is appended, no error shown.
    await expect(list.locator('li')).toHaveCount(2);
    await expect(taskCount).toHaveText('2 tasks');
    await expect(input).toHaveValue('   ');
    await expect(page.locator('#task-empty-message')).toBeHidden();
    await expect(page.locator('.message.error')).toHaveCount(0);

    await finish(page, consoleErrors);
  });

  test('VALIDATION: the required Task name field blocks creation when empty', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await openDashboard(page);

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const createButton = page.getByRole('button', { name: 'Create Task' });

    // Every mandatory field of the 'Create Task' form, confirmed from the real markup:
    // <input id="task-title" ... required />. The filter box is not part of this form.
    const requiredFields = [{ label: 'Task name', field: page.locator('#task-title') }];

    for (const required of requiredFields) {
      const field = required.field;
      await expect(field).toHaveAttribute('required', '');

      // Fill the (only) other values first so only the field under test is missing.
      await field.fill(`Temp ${Date.now()}`);
      await field.fill('');
      await expect(field).toHaveValue('');

      await createButton.click();

      // The browser's own required-field rejection: the field is invalid, focused, and
      // carries the real validation message; no task is created.
      await expect(field).toBeFocused();
      expect(await field.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
      const message = await field.evaluate((el) => (el as HTMLInputElement).validationMessage);
      expect(message.length).toBeGreaterThan(0);

      await expect(list.locator('li')).toHaveCount(2);
      await expect(taskCount).toHaveText('2 tasks');
    }

    await finish(page, consoleErrors);
  });

  test('BOUNDARY: Task name accepts 1 and 209 characters and trims surrounding whitespace', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await openDashboard(page);

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const input = page.getByRole('textbox', { name: 'Task name' });
    const createButton = page.getByRole('button', { name: 'Create Task' });

    // Rule check: the source declares a plain <input type="text" ... required> with no
    // maxlength / minlength attribute at all (maxLength === -1 in the DOM).
    expect(await input.evaluate((el) => (el as HTMLInputElement).maxLength)).toBe(-1);

    // Shortest meaningful value: a single character (no minlength rule) is kept exactly.
    await input.fill('Q');
    await createButton.click();
    await expect(list.locator('li')).toHaveCount(3);
    await expect(list.locator('li').last().locator('span')).toHaveText('Q');
    await expect(taskCount).toHaveText('3 tasks');

    // No upper limit exists: a 209-character name is accepted in full, not cut.
    const longName = `Boundary ${'x'.repeat(200)}`;
    expect(longName.length).toBe(209);
    await input.fill(longName);
    await createButton.click();
    await expect(list.locator('li')).toHaveCount(4);
    await expect(list.locator('li').last().locator('span')).toHaveText(longName);
    await expect(taskCount).toHaveText('4 tasks');

    // One step past the 'no rule' edge that DOES exist: surrounding whitespace is trimmed
    // on save (the handler stores input.value.trim()).
    const paddedName = `   Padded ${Date.now()}   `;
    await input.fill(paddedName);
    await createButton.click();
    await expect(list.locator('li')).toHaveCount(5);
    await expect(list.locator('li').last().locator('span')).toHaveText(paddedName.trim());
    await expect(taskCount).toHaveText('5 tasks');

    await finish(page, consoleErrors);
  });

  test('SECURITY: unsafe markup in a task name stays inert plain text', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await openDashboard(page);

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const input = page.getByRole('textbox', { name: 'Task name' });
    const createButton = page.getByRole('button', { name: 'Create Task' });

    const payload = '<script>alert(1)</script>';
    await input.fill(payload);
    await createButton.click();

    const newRow = list.locator('li').last();
    await expect(newRow.locator('span')).toHaveText(payload);
    await expect(newRow.locator('script')).toHaveCount(0);
    await expect(page.locator('#task-list script')).toHaveCount(0);
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __xssRan?: boolean }).__xssRan === true)).toBe(false);
    await expect(taskCount).toHaveText('3 tasks');

    await finish(page, consoleErrors);
  });

  test('STATE: the dashboard task list shows its empty state when no tasks exist', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await openDashboard(page);

    const list = page.locator('#task-list');
    const taskCount = page.locator('#task-count');
    const emptyMessage = page.locator('#task-empty-message');
    const deleteButtons = page.getByRole('button', { name: 'Delete task' });
    const input = page.getByRole('textbox', { name: 'Task name' });
    const createButton = page.getByRole('button', { name: 'Create Task' });

    // Two seeded rows exist, so no empty state is shown yet.
    await expect(deleteButtons).toHaveCount(2);
    await expect(emptyMessage).toBeHidden();

    await deleteButtons.filter({ visible: true }).first().click();
    await expect(deleteButtons).toHaveCount(1);
    await deleteButtons.filter({ visible: true }).first().click();
    await expect(deleteButtons).toHaveCount(0);

    // Real empty state of this list (message text taken from the page's own markup).
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toHaveText('No tasks yet.');
    await expect(taskCount).toHaveText('0 tasks');

    // Creating a task from the empty state brings the list (and singular counter) back.
    const firstTaskName = `First task ${Date.now()}`;
    test.info().annotations.push({ type: 'test-data', description: `firstTaskName: ${firstTaskName}` });
    await input.fill(firstTaskName);
    await createButton.click();

    await expect(list.locator('li')).toHaveCount(1);
    await expect(list.locator('li').last().locator('span')).toHaveText(firstTaskName);
    await expect(taskCount).toHaveText('1 task');
    await expect(emptyMessage).toBeHidden();

    await finish(page, consoleErrors);
  });
});

// This block starts signed out: the Dashboard must not be reachable without a session.
test.describe('Dashboard session requirement', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SECURITY: the Dashboard is blocked and redirected to the sign-in form when logged out', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchPage(page);

    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });

    // The real sign-in form must appear, not the dashboard content.
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.locator('#task-list')).toHaveCount(0);
    expect(page.url()).toContain('login.html');

    await finish(page, consoleErrors);
  });
});