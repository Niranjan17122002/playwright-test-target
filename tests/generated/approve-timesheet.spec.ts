import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// The tester-provided file for this journey (an .pdf, i.e. NOT a .csv -- the app rejects it).
const TIMESHEET_FILE = path.join(process.env.TEST_DATA_DIR!, 'file-for-approve-a-timesheet-Mike-Milton-jan11to17.pdf'); // hitl: File for Approve a timesheet
const ADMIN_CODE = process.env.HITL_ADMIN_CODE ?? ''; // hitl: Admin code

function trackErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return consoleErrors;
}

async function reportIssues(page: Page, consoleErrors: string[]) {
  const axeResults = await new AxeBuilder({ page }).analyze();
  if (axeResults.violations.length) {
    test.info().annotations.push({
      type: 'a11y-violations',
      description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
    });
  }
  if (consoleErrors.length) {
    test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
  }
}

function writeCsv(fileName: string, content: string): string {
  const p = path.join(os.tmpdir(), fileName);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// The app's timesheet page has NO login gate (timesheet.html is public), so no login step is needed here.

test('POSITIVE: approve a timesheet with a valid CSV, an approver and the admin code', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  const employeeName = `Test Employee ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `employee: ${employeeName}` });

  const csvPath = writeCsv(`timesheet-positive-${Date.now()}.csv`, `Name,Hours\n${employeeName},8\n${employeeName},7.5\n`);

  await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Approve a Timesheet' })).toBeVisible();

  // Step: upload a valid .csv timesheet file
  await page.locator('#timesheet-file').setInputFiles(csvPath);

  // Step: verify the parsed timesheet table and total-hours summary are displayed
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#timesheet-summary')).toContainText('Total hours: 15.50');
  await expect(page.locator('#timesheet-summary')).toContainText(employeeName);

  // Step: choose an approver from the dropdown
  await page.locator('#approver').selectOption('Priya Nair');

  // Step: enter the admin code
  await page.locator('#admin-code').fill(ADMIN_CODE);

  // Step: click 'Approve timesheet'
  await page.getByRole('button', { name: 'Approve timesheet' }).click();

  // Step: verify the approval confirmation message is shown
  const message = page.locator('#timesheet-message');
  await expect(message).toContainText('Timesheet approved by Priya Nair', { timeout: 10000 });
  await expect(message).toContainText('15.50 hours');
  await expect(message).toContainText(employeeName);

  await reportIssues(page, consoleErrors);
});

test('NEGATIVE: approving a timesheet is rejected without a valid admin code or with a non-CSV file', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  const csvPath = writeCsv(`timesheet-negative-${Date.now()}.csv`, `Name,Hours\nNegative User,4\n`);

  await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Approve a Timesheet' })).toBeVisible();

  await page.locator('#timesheet-file').setInputFiles(csvPath);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await page.locator('#approver').selectOption('John Smith');

  // Admin code left empty -> rejected
  await page.getByRole('button', { name: 'Approve timesheet' }).click();
  await expect(page.locator('#timesheet-message')).toHaveText('Enter the admin code.', { timeout: 10000 });
  await expect(page.locator('#timesheet-message')).not.toContainText('Timesheet approved');

  // Wrong admin code -> rejected
  await page.locator('#admin-code').fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Approve timesheet' }).click();
  await expect(page.locator('#timesheet-message')).toHaveText('Wrong admin code.', { timeout: 10000 });
  await expect(page.locator('#timesheet-message')).not.toContainText('Timesheet approved');

  // A non-.csv file is rejected (rule: file name must match /\.csv$/i)
  const nonCsvFile = fs.existsSync(TIMESHEET_FILE)
    ? TIMESHEET_FILE
    : writeCsv(`timesheet-notcsv-${Date.now()}.txt`, 'Name,Hours\nA,1\n');
  await page.locator('#timesheet-file').setInputFiles(nonCsvFile);
  await expect(page.locator('#timesheet-message')).toHaveText('Only .csv timesheets are accepted.', { timeout: 10000 });
  await expect(page.locator('#timesheet-table')).toBeHidden();

  await reportIssues(page, consoleErrors);
});

test('VALIDATION: each required field is enforced (file, approver, admin code)', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  const validCsv = writeCsv(`timesheet-validation-${Date.now()}.csv`, `Name,Hours\nValidation User,3\n`);

  // Real submit-handler validation order/messages (from timesheet.html):
  //   !parsed  -> 'Upload a valid timesheet first.'
  //   !approver-> 'Choose an approver.'
  //   !code    -> 'Enter the admin code.'
  const cases = [
    { label: 'Timesheet file', upload: false, approver: false, code: false, expected: 'Upload a valid timesheet first.' },
    { label: 'Approver', upload: true, approver: false, code: true, expected: 'Choose an approver.' },
    { label: 'Admin code', upload: true, approver: true, code: false, expected: 'Enter the admin code.' },
  ];

  for (const c of cases) {
    await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Approve a Timesheet' })).toBeVisible();

    if (c.upload) {
      await page.locator('#timesheet-file').setInputFiles(validCsv);
      await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
    }
    if (c.approver) {
      await page.locator('#approver').selectOption('Alex Chen');
    }
    if (c.code) {
      await page.locator('#admin-code').fill(ADMIN_CODE);
    }

    await page.getByRole('button', { name: 'Approve timesheet' }).click();
    await expect(page.locator('#timesheet-message'), `Required field left empty: ${c.label}`)
      .toHaveText(c.expected, { timeout: 10000 });
  }

  await reportIssues(page, consoleErrors);
});

test('BOUNDARY: hours minimum is 0 (negative rejected) and file extension is case-insensitive with no length limit', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Approve a Timesheet' })).toBeVisible();

  // Rule -- Hours must parse as a number >= 0 (parseFloat, negative rejected).
  // Right AT the limit: Hours = 0 is accepted.
  const zeroCsv = writeCsv(`ts-zero-${Date.now()}.csv`, `Name,Hours\nZero Hours,0\n`);
  await page.locator('#timesheet-file').setInputFiles(zeroCsv);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#timesheet-summary')).toContainText('Total hours: 0.00');

  // ONE STEP PAST the limit: Hours = -5 is rejected.
  const negCsv = writeCsv(`ts-neg-${Date.now()}.csv`, `Name,Hours\nNegative Hours,-5\n`);
  await page.locator('#timesheet-file').setInputFiles(negCsv);
  await expect(page.locator('#timesheet-message')).toHaveText('Row 2 has invalid hours.', { timeout: 10000 });
  await expect(page.locator('#timesheet-table')).toBeHidden();

  // Rule -- file name must match /\.csv$/i (case-insensitive): an uppercase .CSV is accepted.
  const upperCsv = writeCsv(`ts-upper-${Date.now()}.CSV`, `Name,Hours\nUpper Case,2\n`);
  await page.locator('#timesheet-file').setInputFiles(upperCsv);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#timesheet-summary')).toContainText('Total hours: 2.00');

  // Rule -- Name has no length limit: a 300-character name is accepted as-is.
  const longName = 'A'.repeat(300);
  const longCsv = writeCsv(`ts-long-${Date.now()}.csv`, `Name,Hours\n${longName},1\n`);
  await page.locator('#timesheet-file').setInputFiles(longCsv);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#timesheet-rows')).toContainText(longName.slice(0, 50));

  await reportIssues(page, consoleErrors);
});

test('SECURITY: script-like timesheet content is rendered as inert text and never executes', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  let dialogFired = false;
  page.on('dialog', async d => { dialogFired = true; await d.dismiss(); });

  const payload = '<script>alert(1)</script>';
  const csvPath = writeCsv(`ts-xss-${Date.now()}.csv`, `Name,Hours\n${payload},4\n`);

  await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#timesheet-file').setInputFiles(csvPath);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });

  // The payload cell renders as plain text, not markup.
  await expect(page.locator('#timesheet-rows')).toContainText(payload);
  await expect(page.locator('#timesheet-summary')).toContainText(`Employee: ${payload}`);
  expect(await page.locator('#timesheet-rows script').count()).toBe(0);
  expect(dialogFired).toBe(false);

  // An unsafe string in the admin code field is treated as inert (hashed -> wrong code).
  await page.locator('#approver').selectOption('Priya Nair');
  await page.locator('#admin-code').fill(payload);
  await page.getByRole('button', { name: 'Approve timesheet' }).click();
  await expect(page.locator('#timesheet-message')).toHaveText('Wrong admin code.', { timeout: 10000 });
  expect(dialogFired).toBe(false);

  await reportIssues(page, consoleErrors);
});

test('STATE: the Approve timesheet button stays enabled (app validates on submit, it is never disabled)', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = trackErrors(page);

  await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
  const submit = page.getByRole('button', { name: 'Approve timesheet' });

  // Reality check: the button carries no disabled attribute and is never toggled,
  // so it is enabled even with every field empty.
  await expect(submit).toBeEnabled();

  const csvPath = writeCsv(`ts-state-${Date.now()}.csv`, `Name,Hours\nState User,1\n`);
  await page.locator('#timesheet-file').setInputFiles(csvPath);
  await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 10000 });
  await page.locator('#approver').selectOption('Priya Nair');
  await page.locator('#admin-code').fill(ADMIN_CODE);

  // Still enabled once the form holds valid input.
  await expect(submit).toBeEnabled();

  await reportIssues(page, consoleErrors);
});