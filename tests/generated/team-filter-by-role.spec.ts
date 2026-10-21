import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Evidence-based locators (from team/index.html source + live page structure):
//  - Role filter dropdown: <select id="team-role"> -> combobox named "Role"
//    (the invite form below has a SECOND combobox named "Role", so the filter
//    one is scoped with .first() -- it is the first in DOM order)
//  - Search button is really labelled "Find" (NOT "Search")
//  - Rows: <li class="list-item"> inside <ul id="team-list">
//  - Empty state: <p id="team-empty-message"> "No team members match your search."
//  - Invite email: <input type="email" required id="invite-email"> (only
//    required field on this page)
// ---------------------------------------------------------------------------

const roleFilter = (page: Page) => page.getByRole('combobox', { name: 'Role' }).first();
const findButton = (page: Page) => page.getByRole('button', { name: /^[\s\uE000-\uF8FF]*Find[\s\uE000-\uF8FF]*$/ });
const nameSearch = (page: Page) => page.getByRole('textbox', { name: 'Search by name' });
const emptyMessage = (page: Page) => page.locator('#team-empty-message');
const visibleRows = (page: Page) => page.locator('#team-list .list-item:visible');
const allRows = (page: Page) => page.locator('#team-list .list-item');
const inviteEmail = (page: Page) => page.getByRole('textbox', { name: 'Email' });
const inviteMessage = (page: Page) => page.locator('#invite-message');

function trackDiagnostics(page: Page): string[] {
  const issues: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') issues.push(msg.text());
  });
  page.on('pageerror', err => issues.push(err.message));
  page.on('requestfailed', req =>
    issues.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`),
  );
  page.on('response', res => {
    if (res.status() >= 400) issues.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return issues;
}

async function reportAndScan(page: Page, issues: string[]) {
  if (issues.length) {
    test.info().annotations.push({
      type: 'console-errors',
      description: issues.slice(0, 5).join(' | '),
    });
  }
  const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
}

async function openTeamPage(page: Page) {
  await page.goto('team/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible({ timeout: 15000 });
}

async function clearNameSearch(page: Page) {
  await nameSearch(page).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await expect(nameSearch(page)).toHaveValue('');
}

test('POSITIVE: filtering the team list by the Manager role leaves only managers visible', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  // Reach the Team page the way a user does: the 'Team' link in the navigation.
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('link', { name: /^[\s\uE000-\uF8FF]*Team[\s\uE000-\uF8FF]*$/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible({ timeout: 15000 });

  // Before filtering, every team member is listed.
  await expect(visibleRows(page)).toHaveCount(4);

  await roleFilter(page).selectOption({ label: 'Manager' });
  await findButton(page).click();

  // Only the Manager (Priya Nair) remains visible, with her role tag intact.
  await expect(visibleRows(page)).toHaveCount(1);
  await expect(visibleRows(page).first()).toContainText('Priya Nair');
  await expect(visibleRows(page).first()).toContainText('Manager');
  await expect(allRows(page).filter({ hasText: 'Sam Okafor' })).toBeHidden();
  await expect(allRows(page).filter({ hasText: 'Jordan Lee' })).toBeHidden();
  await expect(allRows(page).filter({ hasText: 'Maria Chen' })).toBeHidden();
  await expect(emptyMessage(page)).toBeHidden();

  // The Team page keeps its search box, role filter, Find button and the
  // 'Invite a team member' form visible while filtering -- only the team list
  // below them narrows, so assert the filtered contents on the list itself.
  await expect(page.locator('#team-list')).toMatchAriaSnapshot(`
    - list:
      - listitem: Priya Nair Manager
  `);

  await reportAndScan(page, issues);
});

test('NEGATIVE: filtering by Manager for a staff-only name shows the empty state and removes no records', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  await openTeamPage(page);

  // 'Sam Okafor' exists but is a Scheduler, so combining that name with the
  // Manager role matches nobody -- the filter must reject it, not invent a row.
  await nameSearch(page).fill('Sam Okafor');
  await roleFilter(page).selectOption({ label: 'Manager' });
  await findButton(page).click();

  await expect(emptyMessage(page)).toBeVisible();
  await expect(emptyMessage(page)).toHaveText('No team members match your search.');
  await expect(visibleRows(page)).toHaveCount(0);

  // Nothing was saved or deleted: all four records are still in the list.
  await expect(allRows(page)).toHaveCount(4);

  // No success message of any kind was shown.
  await expect(inviteMessage(page)).toBeHidden();

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - text: No team members match your search.
  `);

  await reportAndScan(page, issues);
});

test('VALIDATION: the required invite email blocks an empty and a malformed address', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  await openTeamPage(page);

  const submit = page.getByRole('button', { name: 'Send invite' });
  const email = inviteEmail(page);
  await expect(email).toBeVisible();

  // 1) Empty required email -> the browser's own required-field rejection.
  await submit.click();
  expect(await email.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(false);
  expect(await email.evaluate((e) => (e as HTMLInputElement).validationMessage)).not.toBe('');
  await expect(page.locator('#invite-email:invalid')).toHaveCount(1);
  await expect(inviteMessage(page)).toBeHidden();

  // 2) Malformed email ('user@') -> rejected by the type="email" rule.
  await email.fill('user@');
  await submit.click();
  expect(await email.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(false);
  expect(await email.evaluate((e) => (e as HTMLInputElement).validationMessage)).not.toBe('');
  await expect(inviteMessage(page)).toBeHidden();

  // No invite was actually sent for either rejected attempt.
  await expect(page.getByText(/^Invite sent to /)).toHaveCount(0);

  await reportAndScan(page, issues);
});

test('BOUNDARY: name search accepts an extreme 300-character query while the email rule accepts a valid address and rejects "user@"', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  await openTeamPage(page);

  // Rule: the 'Search by name' field declares NO maxLength/minLength/pattern in
  // the source, so an extreme query is expected to be kept exactly as typed and
  // simply match nothing -> the page's real empty-state message.
  const longQuery = 'z'.repeat(300);
  await nameSearch(page).fill(longQuery);
  await expect(nameSearch(page)).toHaveValue(longQuery);
  expect((await nameSearch(page).inputValue()).length).toBe(300);

  await findButton(page).click();
  await expect(emptyMessage(page)).toBeVisible();
  await expect(visibleRows(page)).toHaveCount(0);

  // Clearing the query and filtering again restores the full list.
  await clearNameSearch(page);
  await findButton(page).click();
  await expect(visibleRows(page)).toHaveCount(4);
  await expect(emptyMessage(page)).toBeHidden();

  // Rule: invite Email is an <input type="email"> (no maxLength in source).
  // 'user@' is one step past the email rule -> refused; a well-formed address
  // at the rule -> accepted and the invite message names it.
  const inviteEmailValue = `test.${Date.now()}@example.com`;
  test.info().annotations.push({ type: 'test-data', description: `invite email: ${inviteEmailValue}` });

  const email = inviteEmail(page);
  const submit = page.getByRole('button', { name: 'Send invite' });

  await email.fill('user@');
  await submit.click();
  expect(await email.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(false);
  expect(await email.evaluate((e) => (e as HTMLInputElement).validationMessage)).not.toBe('');
  await expect(inviteMessage(page)).toBeHidden();

  await email.fill(inviteEmailValue);
  expect(await email.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(true);
  await submit.click();
  await expect(page.getByText(`Invite sent to ${inviteEmailValue}`)).toBeVisible();

  await reportAndScan(page, issues);
});

test('SECURITY: script markup typed into the name filter stays inert plain text', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await openTeamPage(page);

  const payload = '<script>alert(1)</script>';
  await nameSearch(page).fill(payload);
  await findButton(page).click();

  // The value is kept literally, no script element is created, nothing executes.
  await expect(nameSearch(page)).toHaveValue(payload);
  await expect(emptyMessage(page)).toBeVisible();
  await expect(visibleRows(page)).toHaveCount(0);
  await expect(page.locator('#team-list script')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible();
  expect(dialogs).toEqual([]);

  await reportAndScan(page, issues);
});

test('STATE: the Find button stays enabled and the full list returns when the role filter is reset', async ({ page }) => {
  test.setTimeout(120000);
  const issues = trackDiagnostics(page);

  await openTeamPage(page);

  // Real button state: the Find button is enabled with nothing selected...
  await expect(findButton(page)).toBeEnabled();
  await expect(roleFilter(page)).toHaveValue('');

  await roleFilter(page).selectOption({ label: 'Staff' });
  await findButton(page).click();
  await expect(visibleRows(page)).toHaveCount(2);
  await expect(visibleRows(page).first()).toContainText('Staff');
  await expect(roleFilter(page)).toHaveValue('staff');

  // ...and it is still enabled once a filter is chosen.
  await expect(findButton(page)).toBeEnabled();

  // Resetting the filter restores every team member.
  await roleFilter(page).selectOption({ label: 'All roles' });
  await findButton(page).click();
  await expect(visibleRows(page)).toHaveCount(4);
  await expect(roleFilter(page)).toHaveValue('');
  await expect(emptyMessage(page)).toBeHidden();

  await reportAndScan(page, issues);
});