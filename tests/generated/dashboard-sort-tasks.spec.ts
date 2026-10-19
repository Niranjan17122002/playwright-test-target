import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The Dashboard page is gated client-side: it redirects to login.html unless
// localStorage.getItem('ttapp_logged_in') === '1' (see dashboard/index.html).
// No login credentials are available for this journey, so each test that needs the
// dashboard simply establishes that same real signed-in state before navigating.

const SORT_BUTTON = /Sort by name/; // real label is 'Sort by name'
const SORT_DESC_BUTTON = /Sort Z.A/; // real label is 'Sort Z–A'

function trackErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return consoleErrors;
}

async function signIn(page: Page) {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('ttapp_logged_in', '1');
    localStorage.setItem('ttapp_role', 'user');
  });
}

async function openDashboard(page: Page) {
  await signIn(page);
  await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

async function runAxe(page: Page) {
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

function reportConsoleErrors(consoleErrors: string[]) {
  if (consoleErrors.length) {
    test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  }
}

function taskTexts(page: Page) {
  return page.locator('#task-list > li').evaluateAll(nodes =>
    nodes.map(n => (n as HTMLElement).getAttribute('data-task') || ''),
  );
}

test('POSITIVE: Sort A–Z reorders the dashboard task list alphabetically', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const nameInput = page.getByRole('textbox', { name: 'Task name' });
  const createBtn = page.getByRole('button', { name: 'Create Task' });

  const ts = Date.now();
  const first = `AAA ${ts} review roster`;
  const last = `ZZZ ${ts} publish shifts`;
  test.info().annotations.push({ type: 'test-data', description: `taskA: ${first}` });
  test.info().annotations.push({ type: 'test-data', description: `taskB: ${last}` });

  // Add the two tasks deliberately out of alphabetical order (Z… then A…).
  await nameInput.fill(last);
  await createBtn.click();
  await expect(page.locator('#task-list > li').filter({ hasText: last })).toHaveCount(1);

  await nameInput.fill(first);
  await createBtn.click();
  await expect(page.locator('#task-list > li').filter({ hasText: first })).toHaveCount(1);

  const before = await taskTexts(page);
  expect(before).toContain(first);
  expect(before).toContain(last);

  // The journey's action under test.
  await page.getByRole('button', { name: SORT_BUTTON }).click();

  const after = await taskTexts(page);
  const expected = [...after].sort((a, b) => a.localeCompare(b));
  // The visible list is genuinely reordered alphabetically by task name.
  expect(after).toEqual(expected);
  // …and the order really changed (it was not already sorted).
  expect(after).not.toEqual(before);
  expect(after[0]).toBe(first);
  expect(after[after.length - 1]).toBe(last);

  // The first rendered row is the alphabetically-first task.
  await expect(page.locator('#task-list > li').first().locator('span')).toHaveText(first);

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Dashboard"
    - textbox "Task name"
    - button "Create Task"
    - button "Sort by name"
    - button "Sort Z–A"
  `);

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test('POSITIVE: Sort Z–A reorders the dashboard task list in reverse alphabetical order', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const nameInput = page.getByRole('textbox', { name: 'Task name' });
  const createBtn = page.getByRole('button', { name: 'Create Task' });

  const ts = Date.now();
  const first = `AAA ${ts} archive rosters`;
  const last = `ZZZ ${ts} close timesheets`;
  test.info().annotations.push({ type: 'test-data', description: `taskA: ${first}` });
  test.info().annotations.push({ type: 'test-data', description: `taskB: ${last}` });

  // Add the two tasks in alphabetical order (A… then Z…) so the reverse click has to change them.
  await nameInput.fill(first);
  await createBtn.click();
  await expect(page.locator('#task-list > li').filter({ hasText: first })).toHaveCount(1);

  await nameInput.fill(last);
  await createBtn.click();
  await expect(page.locator('#task-list > li').filter({ hasText: last })).toHaveCount(1);

  const before = await taskTexts(page);
  expect(before).toContain(first);
  expect(before).toContain(last);

  // The new button under test.
  await page.getByRole('button', { name: SORT_DESC_BUTTON }).click();

  const after = await taskTexts(page);
  const expected = [...after].sort((a, b) => b.localeCompare(a));
  // The visible list is genuinely reordered in reverse alphabetical order.
  expect(after).toEqual(expected);
  // …and the order really changed (it was not already in that order).
  expect(after).not.toEqual(before);
  expect(after[0]).toBe(last);
  expect(after[after.length - 1]).toBe(first);

  // The first rendered row is the alphabetically-last task.
  await expect(page.locator('#task-list > li').first().locator('span')).toHaveText(last);

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test('NEGATIVE: submitting Create Task with no task name is blocked and saves nothing', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const items = page.locator('#task-list > li');
  const nameInput = page.getByRole('textbox', { name: 'Task name' });
  const createBtn = page.getByRole('button', { name: 'Create Task' });

  const beforeCount = await items.count();
  await expect(page.locator('#task-count')).toHaveText(new RegExp(`^${beforeCount} tasks? on your list$`));

  // Attempt the page's own form action with the mandatory field missing.
  await nameInput.fill('');
  await createBtn.click();

  // Nothing was saved: no new row, the same count, the form still open.
  await expect(items).toHaveCount(beforeCount);
  await expect(page.locator('#task-count')).toHaveText(new RegExp(`^${beforeCount} tasks? on your list$`));
  await expect(nameInput).toBeVisible();

  // The rejection is real: the field is invalid and reports the missing-value rule.
  expect(await nameInput.evaluate(el => (el as HTMLInputElement).validity.valid)).toBe(false);
  expect(await nameInput.evaluate(el => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect((await nameInput.evaluate(el => (el as HTMLInputElement).validationMessage)).trim().length).toBeGreaterThan(0);

  // The primary action button is enabled the whole time (the app relies on the
  // browser's own required-field validation rather than a disabled button).
  await expect(createBtn).toBeEnabled();

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test('VALIDATION: Task name is required and blocks submit when empty', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const items = page.locator('#task-list > li');
  const createBtn = page.getByRole('button', { name: 'Create Task' });

  // Every required field confirmed from dashboard/index.html (only 'Task name'
  // carries the required attribute / name="task-title").
  const requiredFields = [
    { name: 'Task name', field: page.getByRole('textbox', { name: 'Task name' }) },
  ];

  for (const { name, field } of requiredFields) {
    const beforeCount = await items.count();

    // All other (mandatory) fields stay valid; only this one is left empty.
    await field.fill('');
    await createBtn.click();

    await expect(field).toBeVisible();
    const state = await field.evaluate(el => {
      const input = el as HTMLInputElement;
      return { valid: input.validity.valid, valueMissing: input.validity.valueMissing, message: input.validationMessage };
    });
    expect(state.valid, `${name}: empty submit must be rejected`).toBe(false);
    expect(state.valueMissing, `${name}: must report the required/missing-value rule`).toBe(true);
    expect(state.message.trim().length, `${name}: must show its required-field message`).toBeGreaterThan(0);

    // Nothing was added.
    await expect(items).toHaveCount(beforeCount);

    // Refill / reset before the next field iteration.
    await field.fill('');
  }

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test('BOUNDARY: Task name has no maxlength so a very long value is kept in full', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const nameInput = page.getByRole('textbox', { name: 'Task name' });
  const createBtn = page.getByRole('button', { name: 'Create Task' });
  const items = page.locator('#task-list > li');

  // Real rule: the input has no maxlength attribute (HTMLInputElement.maxLength === -1),
  // so the field itself imposes no upper limit.
  expect(await nameInput.evaluate(el => (el as HTMLInputElement).maxLength)).toBe(-1);

  const longTitle = `Long ${'X'.repeat(500)}`; // 505 characters
  test.info().annotations.push({ type: 'test-data', description: `long task name length: ${longTitle.length}` });

  await nameInput.fill(longTitle);
  // Value at/over the extreme is kept exactly as typed (nothing truncated).
  expect(await nameInput.inputValue()).toBe(longTitle);

  const beforeCount = await items.count();
  await createBtn.click();
  await expect(items).toHaveCount(beforeCount + 1);

  const row = items.filter({ hasText: 'Long XXXX' });
  await expect(row).toHaveCount(1);
  // The stored task keeps the whole value, no truncation.
  expect(await row.first().getAttribute('data-task')).toBe(longTitle);

  // Whitespace-only input passes the browser's required rule but the app trims it
  // to empty and saves nothing (real observed behaviour).
  const afterLongCount = await items.count();
  await nameInput.fill('   ');
  await createBtn.click();
  await expect(items).toHaveCount(afterLongCount);

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test.describe('signed out', () => {
  // Starts signed out: the run's shared session would skip the sign-in page it looks for.
  test.use({ storageState: { cookies: [], origins: [] } });
  test('SECURITY: Dashboard requires login when signed out', async ({ page }) => {
    const consoleErrors = trackErrors(page);

    // No signed-in state established -> the page must send the user to login.
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/login\.html/, { timeout: 15000 });
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    // The protected dashboard content never rendered.
    await expect(page.locator('#task-list')).toHaveCount(0);
    await expect(page.getByRole('button', { name: SORT_BUTTON })).toHaveCount(0);

    await runAxe(page);
    reportConsoleErrors(consoleErrors);
  });
});

test('SECURITY: task name is rendered as inert plain text (no script execution)', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  let dialogOpened = false;
  page.on('dialog', async dialog => { dialogOpened = true; await dialog.dismiss(); });

  await openDashboard(page);

  const payload = '<script>alert(1)</script>';
  const nameInput = page.getByRole('textbox', { name: 'Task name' });
  await nameInput.fill(payload);
  await page.getByRole('button', { name: 'Create Task' }).click();

  const row = page.locator('#task-list > li').filter({ hasText: payload });
  await expect(row).toHaveCount(1);
  // Shown literally as text…
  await expect(row.first().locator('span')).toHaveText(payload);
  // …and not injected as markup / executed.
  await expect(row.first().locator('script')).toHaveCount(0);
  expect(dialogOpened).toBe(false);

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});

test('STATE: sorting an empty task list leaves it empty and shows the empty state', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await openDashboard(page);

  const items = page.locator('#task-list > li');
  const deleteButtons = page.getByRole('button', { name: 'Delete task' });

  // Empty the list through the UI.
  let remaining = await items.count();
  while (remaining > 0) {
    await deleteButtons.filter({ visible: true }).first().click();
    remaining -= 1;
    await expect(items).toHaveCount(remaining);
  }

  // The page's own empty-state message (word for word from dashboard/index.html).
  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-empty-message')).toHaveText('No tasks yet.');
  await expect(page.locator('#task-count')).toHaveText(/^0 tasks? on your list$/);

  // Sorting an empty list is a safe no-op: still empty, no error, message stays.
  await page.getByRole('button', { name: SORT_BUTTON }).click();

  await expect(items).toHaveCount(0);
  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-count')).toHaveText(/^0 tasks? on your list$/);

  await runAxe(page);
  reportConsoleErrors(consoleErrors);
});