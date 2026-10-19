import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return errors;
}

async function reportDiagnostics(page: Page, consoleErrors: string[]) {
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

/**
 * The dashboard page redirects to login.html unless localStorage has ttapp_logged_in === '1'.
 * The run usually starts signed in; if the session flag is not present we sign in once
 * (this journey's own first step) and then use the top navigation 'Dashboard' link.
 */
async function openDashboard(page: Page) {
  await page.goto('welcome.html', { waitUntil: 'domcontentloaded' });

  const loginHeading = page.getByRole('heading', { name: 'Login', level: 1 });
  const needsLogin = await loginHeading.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (needsLogin) {
    await page.locator('input[name="username"]').fill(process.env.APP_USERNAME ?? '');
    await page.locator('input[name="password"]').fill(process.env.APP_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('You are logged in.', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  await expect(async () => {
    await page.getByRole('navigation').getByRole('link', { name: /^[\s\uE000-\uF8FF]*Dashboard[\s\uE000-\uF8FF]*$/ }).click();
    await expect(page).toHaveURL(/dashboard\/index\.html/, { timeout: 3000 });
  }).toPass({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });
}

test('POSITIVE: Dashboard shows the seeded task list and the correct task count', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectErrors(page);

  await openDashboard(page);

  // Heading of the page the journey is about
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

  // Both seeded tasks are visible in the list
  await expect(page.getByRole('listitem').filter({ hasText: "Publish next week's shifts" })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Approve pending time-off requests' })).toBeVisible();
  await expect(page.locator('#task-list li')).toHaveCount(2);

  // The live task count message below the list matches the number of tasks
  await expect(page.locator('#task-count')).toHaveText('2 tasks');

  // The empty-state message must not be showing while tasks exist
  await expect(page.locator('#task-empty-message')).toBeHidden();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
  - heading "Dashboard" [level=1]
  - paragraph: 2 tasks
`);

  await reportDiagnostics(page, consoleErrors);
});

test('NEGATIVE: Creating a task with an empty name is rejected and the task list is unchanged', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectErrors(page);

  await openDashboard(page);

  const taskInput = page.getByRole('textbox', { name: 'Task name' });
  const createButton = page.getByRole('button', { name: 'Create Task' });

  // The Create Task button is enabled even with an empty name (source: no disabled attribute)
  await taskInput.fill('');
  await expect(createButton).toBeEnabled();

  await createButton.click();

  // The browser's own required check blocks the submit -- the field reports itself invalid
  const validity = await taskInput.evaluate((el: HTMLInputElement) => ({
    valid: el.validity.valid,
    valueMissing: el.validity.valueMissing,
    message: el.validationMessage,
  }));
  expect(validity.valid).toBe(false);
  expect(validity.valueMissing).toBe(true);
  expect(validity.message.trim().length).toBeGreaterThan(0);

  // Nothing was saved: still the same two tasks and the same count
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.locator('#task-list li')).toHaveCount(2);
  await expect(page.locator('#task-count')).toHaveText('2 tasks');
  await expect(page.getByRole('listitem').filter({ hasText: 'Approve pending time-off requests' })).toBeVisible();

  await reportDiagnostics(page, consoleErrors);
});

test('VALIDATION: Every required field on the Dashboard task form blocks submission when left empty', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectErrors(page);

  await openDashboard(page);

  // Confirmed from dashboard/index.html: only the task name input carries `required`
  const requiredFields = [
    { name: 'Task name', field: page.getByRole('textbox', { name: 'Task name' }) },
  ];

  for (const { name, field } of requiredFields) {
    await field.fill('');
    await page.getByRole('button', { name: 'Create Task' }).click();

    const state = await field.evaluate((el: HTMLInputElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
      message: el.validationMessage,
    }));

    expect(state.valueMissing, `${name} should be required`).toBe(true);
    expect(state.valid, `${name} should be reported as invalid when empty`).toBe(false);
    expect(state.message.trim().length, `${name} should surface a required-field message`).toBeGreaterThan(0);

    // Nothing was created while this required field was empty
    await expect(page.locator('#task-list li')).toHaveCount(2);
    await expect(page.locator('#task-count')).toHaveText('2 tasks');

    // refill with a valid value so the next iteration only tests the next field
    await field.fill('Valid placeholder value');
  }

  // A whitespace-only title satisfies the browser's required check but the app trims it
  // and returns early without creating anything (source: if (!title) return;)
  await page.getByRole('textbox', { name: 'Task name' }).fill('   ');
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.locator('#task-list li')).toHaveCount(2);
  await expect(page.locator('#task-count')).toHaveText('2 tasks');

  await reportDiagnostics(page, consoleErrors);
});

test('BOUNDARY: Task name keeps a very long value (no maxLength) and the filter box accepts an extreme query', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectErrors(page);

  await openDashboard(page);

  // Source dashboard/index.html: #task-title has no maxLength / minLength / pattern,
  // so an extreme value is expected to be kept exactly as typed and accepted.
  const taskInput = page.getByRole('textbox', { name: 'Task name' });
  const longTitle = `Boundary ${'A'.repeat(500)}`;
  await taskInput.fill(longTitle);
  await expect(taskInput).toHaveValue(longTitle);

  await page.getByRole('button', { name: 'Create Task' }).click();

  // Observed behaviour: accepted, value not truncated, count grows to 3
  await expect(page.locator('#task-count')).toHaveText('3 tasks');
  const longRow = page.locator('#task-list li').filter({ hasText: 'Boundary AAAAAAAAAA' });
  await expect(longRow).toHaveCount(1);
  await expect(longRow.locator('span')).toHaveText(longTitle);

  // Filter box (#task-search) has no maxLength either: an extreme query is typed in full
  // and simply matches nothing, which surfaces the page's real empty-search message.
  const searchBox = page.getByRole('searchbox', { name: 'Filter tasks' });
  const longQuery = `zz${'q'.repeat(300)}`;
  await searchBox.fill(longQuery);
  await expect(searchBox).toHaveValue(longQuery);
  await expect(page.locator('#task-search-empty')).toBeVisible();
  await expect(page.locator('#task-search-empty')).toHaveText('No task matches your search.');

  await reportDiagnostics(page, consoleErrors);
});

test.describe('Dashboard requires a signed-in session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SECURITY: Signed-out access to the Dashboard is redirected to Login, and task titles render as inert text', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = collectErrors(page);

    // 1) A page that needs a session must be blocked when signed out
    await page.goto('dashboard/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('#task-list')).toHaveCount(0);

    // 2) Sign in so the dashboard itself can be reached for the unsafe-text check
    await page.locator('input[name="username"]').fill(process.env.APP_USERNAME ?? '');
    await page.locator('input[name="password"]').fill(process.env.APP_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('You are logged in.', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('navigation').getByRole('link', { name: /^[\s\uE000-\uF8FF]*Dashboard[\s\uE000-\uF8FF]*$/ }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });

    // 3) An unsafe string must be stored and rendered as inert plain text
    let dialogFired = false;
    page.on('dialog', async dialog => { dialogFired = true; await dialog.dismiss().catch(() => {}); });

    const payload = '<script>alert(1)</script>';
    await page.getByRole('textbox', { name: 'Task name' }).fill(payload);
    await page.getByRole('button', { name: 'Create Task' }).click();

    const injectedRow = page.locator('#task-list li').filter({ hasText: payload });
    await expect(injectedRow).toHaveCount(1);
    await expect(injectedRow.locator('span')).toHaveText(payload);
    await expect(page.locator('#task-count')).toHaveText('3 tasks');
    expect(dialogFired).toBe(false);

    await reportDiagnostics(page, consoleErrors);
  });
});

test('STATE: Dashboard shows its real empty states when the filter matches nothing and when all tasks are deleted', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = collectErrors(page);

  await openDashboard(page);
  await expect(page.locator('#task-list li')).toHaveCount(2);

  // Real empty-search state (dashboard/index.html renders this exact wording)
  await page.getByRole('searchbox', { name: 'Filter tasks' }).fill('zzzz-no-such-task');
  await expect(page.locator('#task-search-empty')).toBeVisible();
  await expect(page.locator('#task-search-empty')).toHaveText('No task matches your search.');
  await page.getByRole('searchbox', { name: 'Filter tasks' }).fill('');
  await expect(page.locator('#task-search-empty')).toBeHidden();

  // Real empty-list state: delete every task through the list's own Delete buttons
  const deleteButtons = page.getByRole('button', { name: 'Delete task' });
  await expect(deleteButtons).toHaveCount(2);
  await deleteButtons.filter({ visible: true }).first().click();
  await expect(deleteButtons).toHaveCount(1);
  await expect(page.locator('#task-count')).toHaveText('1 task');
  await deleteButtons.filter({ visible: true }).first().click();
  await expect(deleteButtons).toHaveCount(0);

  await expect(page.locator('#task-empty-message')).toBeVisible();
  await expect(page.locator('#task-empty-message')).toHaveText('No tasks yet.');
  await expect(page.locator('#task-count')).toHaveText('0 tasks');

  await reportDiagnostics(page, consoleErrors);
});