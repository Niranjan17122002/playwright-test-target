import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEAM_PAGE = 'team/index.html';
const EMPTY_MESSAGE = 'No team members match your search.';

// Real directory rendered by team/index.html (name + role tag).
const TEAM_MEMBERS = [
  { name: 'Priya Nair', role: 'Manager' },
  { name: 'Sam Okafor', role: 'Scheduler' },
  { name: 'Jordan Lee', role: 'Staff' },
  { name: 'Maria Chen', role: 'Staff' },
] as const;

function attachDiagnostics(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req =>
    consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`),
  );
  page.on('response', res => {
    if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return consoleErrors;
}

async function reportDiagnostics(page: Page, consoleErrors: string[]): Promise<void> {
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

async function openTeamPage(page: Page): Promise<void> {
  await page.goto(TEAM_PAGE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible({ timeout: 15000 });
}

test('POSITIVE: user reaches the Team page from the top navigation and sees every member with their role tag', async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors = attachDiagnostics(page);

  // Start on the home page and use the real 'Team' nav link.
  await page.goto('', { waitUntil: 'domcontentloaded' });

  const teamNavLink = page.getByRole('link', { name: /^[\s\uE000-\uF8FF]*Team[\s\uE000-\uF8FF]*$/ }).filter({ visible: true }).first();
  await expect(teamNavLink).toBeVisible({ timeout: 15000 });

  await expect(async () => {
    await teamNavLink.click();
    await expect(page).toHaveURL(/team\/index\.html/, { timeout: 3000 });
  }).toPass({ timeout: 20000 });

  // Page heading of the destination page (not the nav link).
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible({ timeout: 15000 });

  const teamList = page.locator('#team-list');
  await expect(teamList.getByRole('listitem')).toHaveCount(TEAM_MEMBERS.length);

  for (const member of TEAM_MEMBERS) {
    const item = teamList.getByRole('listitem').filter({ hasText: member.name });
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item).toContainText(member.name);
    // The role tag rendered next to the name.
    await expect(item.getByText(member.role, { exact: true })).toBeVisible();
  }

  // The list's own primary action stays usable for a normal browse.
  await expect(page.getByRole('button', { name: 'Find' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find' })).toBeEnabled();

  // Short ARIA check of the result area (the Team main region).
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Team" [level=1]
    - textbox "Search by name"
    - button "Find"
  `);

  await reportDiagnostics(page, consoleErrors);
});

test('NEGATIVE: searching for a member who does not exist is rejected with the real empty-state message and shows no member entries', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = attachDiagnostics(page);

  const missingName = `Zzz No Such Person ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `missing member search: ${missingName}` });

  await openTeamPage(page);

  const teamList = page.locator('#team-list');
  const visibleItems = page.locator('#team-list li:visible');
  const emptyMessage = page.getByText(EMPTY_MESSAGE, { exact: true });

  // Baseline: all four members are listed before filtering.
  await expect(visibleItems).toHaveCount(TEAM_MEMBERS.length);
  await expect(emptyMessage).toBeHidden();

  const search = page.getByRole('textbox', { name: 'Search by name' });
  await search.fill(missingName);
  await page.getByRole('button', { name: 'Find' }).click();

  // The app's own empty-state message for a query that matches nobody.
  await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  await expect(visibleItems).toHaveCount(0);
  // Nothing was added or substituted: the directory itself is unchanged.
  // Filtering only hides rows with display:none, so they stay in the DOM but
  // drop out of the accessibility tree -- count the real <li> rows, not roles.
  await expect(teamList.locator('li')).toHaveCount(TEAM_MEMBERS.length);
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible();

  await reportDiagnostics(page, consoleErrors);
});

test('BOUNDARY: Search by name has no maxlength rule (a 500-character query is kept as typed and matches nothing) while a 1-character query still matches', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = attachDiagnostics(page);

  // No maxlength/minlength/pattern on #team-search in the source, so the
  // extreme (way past any practical limit) value is the generic extreme input.
  const longQuery = 'x'.repeat(500);
  test.info().annotations.push({ type: 'test-data', description: `extreme search query length: ${longQuery.length}` });

  await openTeamPage(page);

  const search = page.getByRole('textbox', { name: 'Search by name' });
  const findButton = page.getByRole('button', { name: 'Find' });
  const visibleItems = page.locator('#team-list li:visible');
  const emptyMessage = page.getByText(EMPTY_MESSAGE, { exact: true });

  // 500 chars: kept exactly as typed (no truncation) and matches nobody.
  await search.fill(longQuery);
  expect(await search.inputValue()).toHaveLength(500);
  await findButton.click();
  await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  await expect(visibleItems).toHaveCount(0);

  // 1 char ('a' appears in all four real names): accepted and matches everyone.
  await search.fill('a');
  expect(await search.inputValue()).toBe('a');
  await findButton.click();
  await expect(visibleItems).toHaveCount(TEAM_MEMBERS.length, { timeout: 5000 });
  await expect(emptyMessage).toBeHidden();

  await reportDiagnostics(page, consoleErrors);
});

test('SECURITY: an HTML/script payload typed into Search by name stays inert plain text and never executes', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = attachDiagnostics(page);

  let dialogMessage: string | null = null;
  page.on('dialog', async dialog => {
    dialogMessage = dialog.message();
    await dialog.dismiss().catch(() => undefined);
  });

  const payload = '<script>alert(1)</script>';
  test.info().annotations.push({ type: 'test-data', description: `xss payload: ${payload}` });

  await openTeamPage(page);

  const search = page.getByRole('textbox', { name: 'Search by name' });
  await search.fill(payload);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.waitForTimeout(500);

  // Nothing executed.
  expect(dialogMessage).toBeNull();
  // Nothing was injected into the list DOM.
  expect(await page.evaluate(() => document.querySelectorAll('#team-list script').length)).toBe(0);
  // The raw string is kept as inert text in the field.
  expect(await search.inputValue()).toBe(payload);
  // The page stays intact: empty-state for the unmatched query, directory untouched.
  await expect(page.getByText(EMPTY_MESSAGE, { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible();
  await expect(page.locator('#team-list li')).toHaveCount(TEAM_MEMBERS.length);

  await reportDiagnostics(page, consoleErrors);
});