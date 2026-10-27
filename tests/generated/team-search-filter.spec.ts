import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEAM_PATH = 'team/index.html';
const EMPTY_STATE_TEXT = 'No team members match your search.';

function trackRuntimeIssues(page: Page): string[] {
  const issues: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') issues.push(msg.text()); });
  page.on('pageerror', err => issues.push(err.message));
  page.on('requestfailed', req => issues.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) issues.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return issues;
}

async function reportAndScan(page: Page, issues: string[]) {
  if (issues.length) {
    test.info().annotations.push({ type: 'console-errors', description: issues.slice(0, 5).join(' | ') });
  }
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

// Real controls on team/index.html (verified live): the page has TWO comboboxes named "Role"
// (the search filter and the invite form), so the filter one is addressed by its own id.
const searchInput = (page: Page) => page.locator('#team-search');
const roleSelect = (page: Page) => page.locator('#team-role');
const findButton = (page: Page) => page.getByRole('button', { name: 'Find' });
const allRows = (page: Page) => page.locator('#team-list .list-item');
const visibleRows = (page: Page) => page.locator('#team-list .list-item:visible');
const emptyMessage = (page: Page) => page.locator('#team-empty-message');

async function openTeamPage(page: Page) {
  await page.goto(TEAM_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^[\s\uE000-\uF8FF]*Team[\s\uE000-\uF8FF]*$/ })).toBeVisible({ timeout: 15000 });
  await expect(allRows(page)).toHaveCount(4);
}

// The list is filtered ONLY when the Find button is clicked (confirmed in the page script).
async function runSearch(page: Page, query: string, role?: string) {
  await searchInput(page).fill(query);
  if (role !== undefined) await roleSelect(page).selectOption(role);
  await findButton(page).click();
}

test('POSITIVE: searching "Priya" with role Manager narrows the team list to the single matching member', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openTeamPage(page);
  await expect(visibleRows(page)).toHaveCount(4);

  await runSearch(page, 'Priya', 'manager');

  const priya = allRows(page).filter({ hasText: 'Priya Nair' });
  await expect(priya).toBeVisible();
  await expect(priya).toContainText('Priya Nair');
  await expect(priya).toContainText('Manager');
  await expect(visibleRows(page)).toHaveCount(1);

  for (const other of ['Sam Okafor', 'Jordan Lee', 'Maria Chen']) {
    await expect(allRows(page).filter({ hasText: other })).toBeHidden();
  }
  await expect(emptyMessage(page)).toBeHidden();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Team" [level=1]
    - button "Find"
  `);

  await reportAndScan(page, issues);
});

test('NEGATIVE: a search for a non-existent team member shows the empty-state message and no rows', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openTeamPage(page);

  await runSearch(page, 'Zzz Nonexistent Person');

  await expect(emptyMessage(page)).toBeVisible();
  await expect(emptyMessage(page)).toHaveText(EMPTY_STATE_TEXT);
  await expect(visibleRows(page)).toHaveCount(0);
  for (const name of ['Priya Nair', 'Sam Okafor', 'Jordan Lee', 'Maria Chen']) {
    await expect(allRows(page).filter({ hasText: name })).toBeHidden();
  }
  // The search field keeps what was typed (nothing was "saved"/cleared behind the user's back).
  await expect(searchInput(page)).toHaveValue('Zzz Nonexistent Person');

  await reportAndScan(page, issues);
});

test('BOUNDARY: the search field has no maxlength (source: plain text input), so a 1-char query filters and a 300-char query is kept in full and matches nothing', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openTeamPage(page);

  // ---- right at the low end: a single character still filters ----
  const singleCharQuery = 'P';
  await runSearch(page, singleCharQuery);
  await expect(searchInput(page)).toHaveValue(singleCharQuery);
  await expect(visibleRows(page)).toHaveCount(1);
  await expect(allRows(page).filter({ hasText: 'Priya Nair' })).toBeVisible();
  await expect(emptyMessage(page)).toBeHidden();

  // ---- extreme input: 300 characters, one step far past any practical length ----
  const longQuery = 'a'.repeat(300);
  await runSearch(page, longQuery);
  // No length limit exists on this field, so the whole value is kept (not truncated/rejected).
  await expect(searchInput(page)).toHaveValue(longQuery);
  await expect(searchInput(page)).toHaveValue(new RegExp(`^a{300}$`));
  // ...and it genuinely matches no team member, so the app reports the empty state.
  await expect(visibleRows(page)).toHaveCount(0);
  await expect(emptyMessage(page)).toBeVisible();
  await expect(emptyMessage(page)).toHaveText(EMPTY_STATE_TEXT);

  await reportAndScan(page, issues);
});

test('SECURITY: an HTML/script payload typed into the search field stays inert plain text and never executes', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  const payload = '<script>alert(1)</script>';
  test.info().annotations.push({ type: 'test-data', description: `search payload: ${payload}` });

  let dialogCount = 0;
  page.on('dialog', async dialog => { dialogCount++; await dialog.dismiss(); });

  await openTeamPage(page);
  await runSearch(page, payload);

  // The payload is just text in the input, not markup that got rendered/executed.
  await expect(searchInput(page)).toHaveValue(payload);
  await expect(page.locator('#team-list script')).toHaveCount(0);
  await expect(emptyMessage(page)).toHaveText(EMPTY_STATE_TEXT);
  await expect(visibleRows(page)).toHaveCount(0);
  expect(dialogCount).toBe(0);

  await reportAndScan(page, issues);
});

test('STATE: filtering by role alone lists only that role and selecting All roles restores every member', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openTeamPage(page);

  await runSearch(page, '', 'staff');
  await expect(visibleRows(page)).toHaveCount(2);
  await expect(allRows(page).filter({ hasText: 'Jordan Lee' })).toBeVisible();
  await expect(allRows(page).filter({ hasText: 'Maria Chen' })).toBeVisible();
  await expect(allRows(page).filter({ hasText: 'Priya Nair' })).toBeHidden();
  await expect(allRows(page).filter({ hasText: 'Sam Okafor' })).toBeHidden();
  await expect(emptyMessage(page)).toBeHidden();

  // Reset back to All roles - every previously hidden row must come back.
  await roleSelect(page).selectOption('');
  await findButton(page).click();
  await expect(visibleRows(page)).toHaveCount(4);
  await expect(allRows(page).filter({ hasText: 'Priya Nair' })).toBeVisible();
  await expect(allRows(page).filter({ hasText: 'Sam Okafor' })).toBeVisible();
  await expect(emptyMessage(page)).toBeHidden();

  await reportAndScan(page, issues);
});

test('STATE: a name that does not match the selected role empties the list and shows the empty state', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openTeamPage(page);

  // Priya Nair is a Manager, so name + role Staff must yield nothing (both conditions are ANDed).
  await runSearch(page, 'Priya', 'staff');

  await expect(visibleRows(page)).toHaveCount(0);
  await expect(emptyMessage(page)).toBeVisible();
  await expect(emptyMessage(page)).toHaveText(EMPTY_STATE_TEXT);
  await expect(allRows(page).filter({ hasText: 'Priya Nair' })).toBeHidden();
  await expect(allRows(page).filter({ hasText: 'Jordan Lee' })).toBeHidden();

  await reportAndScan(page, issues);
});