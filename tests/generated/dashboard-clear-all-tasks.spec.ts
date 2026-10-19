import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DASHBOARD_PATH = 'dashboard/index.html';
const CLEAR_CONFIRM_MESSAGE = 'Remove every task from the list?';

function watchConsole(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return consoleErrors;
}

function reportConsoleErrors(consoleErrors: string[]): void {
  if (consoleErrors.length) {
    test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  }
}

async function reportA11y(page: Page): Promise<void> {
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

function clearAllTasksButton(page: Page) {
  return page.getByRole('button', { name: /^[\s\uE000-\uF8FF]*Clear\ all\ tasks[\s\uE000-\uF8FF]*$/ });
}

// The clear-all action is guarded by a window.confirm(); register the answer BEFORE clicking
// and collect the real dialog text so it can be asserted afterwards.
function answerNextConfirm(page: Page, action: 'accept' | 'dismiss'): string[] {
  const messages: string[] = [];
  page.once('dialog', async dialog => {
    messages.push(dialog.message());
    if (action === 'accept') await dialog.accept();
    else await dialog.dismiss();
  });
  return messages;
}

// The app is already signed in for this run (saved session in localStorage).
async function openDashboard(page: Page): Promise<void> {
  await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^[\s\uE000-\uF8FF]*Dashboard[\s\uE000-\uF8FF]*$/ })).toBeVisible({ timeout: 15000 });
}

test.describe('Dashboard - clear all tasks', () => {
  test('POSITIVE: clearing all tasks empties the dashboard list and shows the empty state', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchConsole(page);

    await openDashboard(page);

    const taskItems = page.locator('#task-list li');
    const taskCount = page.locator('#task-count');
    const emptyMessage = page.locator('#task-empty-message');

    // Precondition from the journey: at least one task exists and the count message agrees.
    await expect(taskItems.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await taskItems.count();
    expect(initialCount).toBeGreaterThan(0);
    await expect(taskCount).toHaveText(new RegExp(`^${initialCount} tasks? on your list$`));
    await expect(emptyMessage).toBeHidden();

    const clearButton = clearAllTasksButton(page);
    await expect(clearButton).toBeVisible();
    await expect(clearButton).toBeEnabled();

    const dialogMessages = answerNextConfirm(page, 'accept');
    await clearButton.click();

    // Result of the action: every row is gone.
    await expect(taskItems).toHaveCount(0, { timeout: 10000 });
    expect(dialogMessages).toEqual([CLEAR_CONFIRM_MESSAGE]);

    // Result of the action: empty-state message and the count message.
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toHaveText('No tasks yet.');
    await expect(taskCount).toHaveText('0 tasks on your list');
    await expect(page.getByText("Publish next week's shifts", { exact: true })).toHaveCount(0);
    await expect(page.getByText('Approve pending time-off requests', { exact: true })).toHaveCount(0);

    await expect(page.locator('main')).toMatchAriaSnapshot(`
      - heading "Dashboard"
      - button "Clear all tasks"
      - paragraph: No tasks yet.
    `);

    await reportA11y(page);
    reportConsoleErrors(consoleErrors);
  });

  test('NEGATIVE: dismissing the confirmation dialog leaves every task on the list', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchConsole(page);

    await openDashboard(page);

    const taskItems = page.locator('#task-list li');
    await expect(taskItems.first()).toBeVisible({ timeout: 10000 });
    const before = await taskItems.count();
    expect(before).toBeGreaterThan(0);
    const taskTexts = await page.locator('#task-list li span').allTextContents();
    expect(taskTexts.length).toBe(before);

    // The user says "no" to the confirmation.
    const dialogMessages = answerNextConfirm(page, 'dismiss');
    await clearAllTasksButton(page).click();

    // Give an (incorrect) wipe the chance to happen before asserting nothing did.
    await page.waitForTimeout(500);

    await expect(taskItems).toHaveCount(before, { timeout: 10000 });
    for (const text of taskTexts) {
      await expect(page.locator('#task-list')).toContainText(text);
    }
    await expect(page.locator('#task-empty-message')).toBeHidden();
    await expect(page.locator('#task-count')).toHaveText(new RegExp(`^${before} tasks? on your list$`));
    expect(dialogMessages).toEqual([CLEAR_CONFIRM_MESSAGE]);

    await reportA11y(page);
    reportConsoleErrors(consoleErrors);
  });

  test('BOUNDARY: clearing an already empty list stays at 0 tasks and the button stays enabled', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchConsole(page);

    await openDashboard(page);

    const taskItems = page.locator('#task-list li');
    const taskCount = page.locator('#task-count');
    const emptyMessage = page.locator('#task-empty-message');

    await expect(taskItems.first()).toBeVisible({ timeout: 10000 });

    // First pass: wipe the list down to 0 items (the lower boundary of the list).
    let dialogMessages = answerNextConfirm(page, 'accept');
    await clearAllTasksButton(page).click();
    await expect(taskItems).toHaveCount(0, { timeout: 10000 });
    await expect(taskCount).toHaveText('0 tasks on your list');
    expect(dialogMessages).toEqual([CLEAR_CONFIRM_MESSAGE]);

    // At exactly 0 items the action is still offered (it is never greyed out in this app).
    const clearButton = clearAllTasksButton(page);
    await expect(clearButton).toBeEnabled();

    // One step past the boundary: repeating the action on an empty list must stay at 0,
    // with a single empty-state message and no duplicate count message.
    dialogMessages = answerNextConfirm(page, 'accept');
    await clearButton.click();
    await expect(taskItems).toHaveCount(0, { timeout: 10000 });
    expect(dialogMessages).toEqual([CLEAR_CONFIRM_MESSAGE]);

    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toHaveText('No tasks yet.');
    await expect(emptyMessage).toHaveCount(1);
    await expect(taskCount).toHaveText('0 tasks on your list');
    await expect(taskCount).toHaveCount(1);

    await reportA11y(page);
    reportConsoleErrors(consoleErrors);
  });
});

test.describe('signed-out access to the dashboard', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SECURITY: the dashboard task list cannot be reached without a session', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = watchConsole(page);

    await page.goto(DASHBOARD_PATH, { waitUntil: 'domcontentloaded' });

    // The page's own session guard sends a signed-out visitor to the login form.
    await expect(page.getByRole('heading', { name: /^[\s\uE000-\uF8FF]*Login[\s\uE000-\uF8FF]*$/ })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /^[\s\uE000-\uF8FF]*Log\ in[\s\uE000-\uF8FF]*$/ })).toBeVisible();
    await expect(page).toHaveURL(/login\.html/);

    // None of the dashboard's task controls may be reachable.
    await expect(page.getByRole('heading', { name: /^[\s\uE000-\uF8FF]*Dashboard[\s\uE000-\uF8FF]*$/ })).toHaveCount(0);
    await expect(page.locator('#task-list')).toHaveCount(0);
    await expect(page.locator('#clear-all-tasks')).toHaveCount(0);
    await expect(page.locator('#task-empty-message')).toHaveCount(0);

    await expect(page.locator('main')).toMatchAriaSnapshot(`
      - heading "Login"
      - button "Log in"
    `);

    await reportA11y(page);
    reportConsoleErrors(consoleErrors);
  });
});