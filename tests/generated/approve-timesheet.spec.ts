import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';
const TIMESHEET_FILE = path.join(process.env.TEST_DATA_DIR!, 'file-for-approve-a-timesheet-mike-milton-timesheet.csv'); // hitl: File for Approve a timesheet
const ADMIN_CODE = process.env.HITL_ADMIN_CODE ?? ''; // hitl: Admin code
const APPROVER = 'Priya Nair';
let consoleErrors: string[] = [];
const message = (page: Page) => page.locator('#timesheet-message');
const approveBtn = (page: Page) => page.getByRole('button', { name: 'Approve timesheet' });
async function uploadTimesheet(page: Page) { await page.locator('#timesheet-file').setInputFiles(TIMESHEET_FILE); await expect(page.locator('#timesheet-table')).toBeVisible({ timeout: 15000 }); }
async function uploadBuffer(page: Page, name: string, body: string) { await page.locator('#timesheet-file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(body) }); }
test.beforeEach(async ({ page }) => { consoleErrors = []; page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); }); page.on('pageerror', err => consoleErrors.push(err.message)); page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`)); page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); }); await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' }); });
test.afterEach(async ({ page }) => { if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') }); const axeResults = await new AxeBuilder({ page }).analyze(); if (axeResults.violations.length) test.info().annotations.push({ type: 'a11y-violations', description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | ') }); });
test('POSITIVE: Approve a valid timesheet as admin', async ({ page }) => {
  test.setTimeout(120000);
  await uploadTimesheet(page);
  await expect(page.locator('#timesheet-summary')).toContainText('Total hours:');
  await expect(page.locator('#timesheet-table')).toBeVisible();
  await page.locator('#approver').selectOption(APPROVER);
  await page.locator('#admin-code').fill(ADMIN_CODE);
  await approveBtn(page).click();
  await expect(message(page)).toContainText(`Timesheet approved by ${APPROVER}`, { timeout: 15000 });
});
test('NEGATIVE: Approval is blocked without a timesheet, approver, or correct admin code', async ({ page }) => {
  test.setTimeout(120000);
  await approveBtn(page).click();
  await expect(message(page)).toHaveText('Upload a valid timesheet first.');
  await uploadTimesheet(page);
  await approveBtn(page).click();
  await expect(message(page)).toHaveText('Choose an approver.');
  await page.locator('#approver').selectOption(APPROVER);
  await approveBtn(page).click();
  await expect(message(page)).toHaveText('Enter the admin code.');
  await page.locator('#admin-code').fill('WrongPassword123!');
  await approveBtn(page).click();
  await expect(message(page)).toHaveText('Wrong admin code.', { timeout: 15000 });
});
test('VALIDATION: Each required field is enforced individually', async ({ page }) => {
  test.setTimeout(120000);
  const cases = [
    { expected: 'Upload a valid timesheet first.', prepare: async () => {} },
    { expected: 'Choose an approver.', prepare: async () => { await uploadTimesheet(page); } },
    { expected: 'Enter the admin code.', prepare: async () => { await uploadTimesheet(page); await page.locator('#approver').selectOption(APPROVER); } },
  ];
  for (const c of cases) {
    await page.goto('timesheet.html', { waitUntil: 'domcontentloaded' });
    await c.prepare();
    await approveBtn(page).click();
    await expect(message(page)).toHaveText(c.expected, { timeout: 15000 });
  }
});
test('BOUNDARY: CSV validation rules and the primary button state', async ({ page }) => {
  test.setTimeout(120000);
  await page.locator('#timesheet-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Name,Hours\nMike,8') });
  await expect(message(page)).toHaveText('Only .csv timesheets are accepted.');
  await uploadBuffer(page, 'bad.csv', 'Employee,Mins\nMike,8');
  await expect(message(page)).toHaveText('Missing column(s): Name, Hours');
  await uploadBuffer(page, 'empty.csv', 'Name,Hours\n');
  await expect(message(page)).toHaveText('The timesheet has no rows.');
  await uploadBuffer(page, 'neg.csv', 'Name,Hours\nMike,-1');
  await expect(message(page)).toHaveText('Row 2 has invalid hours.');
  await uploadBuffer(page, 'zero.csv', 'Name,Hours\nMike,0');
  await expect(page.locator('#timesheet-summary')).toContainText('Total hours: 0.00');
  await expect(approveBtn(page)).toBeEnabled();
});
test('SECURITY: Admin code is masked and unsafe input stays inert', async ({ page }) => {
  test.setTimeout(120000);
  await expect(page.locator('#admin-code')).toHaveAttribute('type', 'password');
  await uploadTimesheet(page);
  await page.locator('#approver').selectOption(APPROVER);
  let dialogFired = false;
  page.on('dialog', d => { dialogFired = true; d.dismiss().catch(() => {}); });
  await page.locator('#admin-code').fill('<script>alert(1)</script>');
  await approveBtn(page).click();
  await expect(message(page)).toHaveText('Wrong admin code.', { timeout: 15000 });
  expect(dialogFired).toBe(false);
  await expect(message(page)).not.toContainText('<script>');
});