import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CONTACT_PATH = 'contact.html';
const SUCCESS_TEXT = 'Thanks! Your message has been sent.';

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

const nameInput = (page: Page) => page.getByRole('textbox', { name: 'Name' });
const emailInput = (page: Page) => page.getByRole('textbox', { name: 'Email' });
const messageInput = (page: Page) => page.getByRole('textbox', { name: 'Message' });
const sendButton = (page: Page) => page.getByRole('button', { name: 'Send' });
const resultMessage = (page: Page) => page.locator('#contact-message');

async function openContact(page: Page) {
  await page.goto(CONTACT_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible({ timeout: 15000 });
}

async function fillAll(page: Page, name: string, email: string, message: string) {
  await nameInput(page).fill(name);
  await emailInput(page).fill(email);
  await messageInput(page).fill(message);
}

test('POSITIVE: submitting the contact form with valid name, email and message shows the success message and resets the form', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  const stamp = Date.now();
  const name = `Tester ${stamp}`;
  const email = `test.${stamp}@example.com`;
  const message = `Hello, this is a test message ${stamp}`;
  test.info().annotations.push({ type: 'test-data', description: `name: ${name}, email: ${email}` });

  await openContact(page);
  await fillAll(page, name, email, message);
  await sendButton(page).click();

  await expect(resultMessage(page)).toHaveText(SUCCESS_TEXT);
  await expect(resultMessage(page)).toHaveClass(/success/);
  // The form is reset after a successful send
  await expect(nameInput(page)).toHaveValue('');
  await expect(emailInput(page)).toHaveValue('');
  await expect(messageInput(page)).toHaveValue('');

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Contact Us" [level=1]
    - button "Send"
    - text: ${SUCCESS_TEXT}
  `);

  await reportAndScan(page, issues);
});

test('NEGATIVE: submitting an empty contact form is blocked and no success message appears', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openContact(page);

  await sendButton(page).click();

  await expect(resultMessage(page)).toBeEmpty();
  await expect(resultMessage(page)).not.toContainText(SUCCESS_TEXT);
  expect(await nameInput(page).evaluate(e => (e as HTMLInputElement).validity.valid)).toBe(false);
  await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();

  await reportAndScan(page, issues);
});

test('VALIDATION: each required field (Name, Email, Message) blocks the submit when it is empty', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openContact(page);

  const valid = { name: 'Valid Name', email: `test.${Date.now()}@example.com`, message: 'Valid message body' };
  const fields = [
    { label: 'Name', loc: nameInput(page), key: 'name' as const },
    { label: 'Email', loc: emailInput(page), key: 'email' as const },
    { label: 'Message', loc: messageInput(page), key: 'message' as const },
  ];

  for (const f of fields) {
    await fillAll(page, valid.name, valid.email, valid.message);
    await f.loc.fill('');
    await sendButton(page).click();

    await expect(resultMessage(page)).toBeEmpty();
    const state = await f.loc.evaluate(e => {
      const el = e as HTMLInputElement | HTMLTextAreaElement;
      return { valueMissing: el.validity.valueMissing, message: el.validationMessage };
    });
    expect(state.valueMissing, `${f.label} should be flagged as missing`).toBe(true);
    expect(state.message, `${f.label} should have a browser validation message`).not.toBe('');
    // Other fields keep their values - nothing was submitted/reset
    for (const other of fields.filter(o => o.key !== f.key)) {
      await expect(other.loc).toHaveValue(valid[other.key]);
    }
    await f.loc.fill(valid[f.key]);
  }

  await reportAndScan(page, issues);
});

test('BOUNDARY: Email must be a valid email (type="email"): "user@example.com" is accepted, "user@" is rejected; Name and Message have no length limit', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openContact(page);

  // One step past the rule: incomplete email
  await fillAll(page, 'Boundary Tester', 'user@', 'Message body');
  await sendButton(page).click();
  expect(await emailInput(page).evaluate(e => (e as HTMLInputElement).validity.typeMismatch)).toBe(true);
  await expect(resultMessage(page)).toBeEmpty();
  await expect(emailInput(page)).toHaveValue('user@');

  // At the rule: minimal valid email
  const longName = 'N'.repeat(300);
  const longMessage = 'M'.repeat(2000);
  await fillAll(page, longName, 'user@example.com', longMessage);
  // No maxlength on Name/Message: values are kept in full
  await expect(nameInput(page)).toHaveValue(longName);
  await expect(messageInput(page)).toHaveValue(longMessage);
  expect(await emailInput(page).evaluate(e => (e as HTMLInputElement).validity.valid)).toBe(true);
  await sendButton(page).click();
  await expect(resultMessage(page)).toHaveText(SUCCESS_TEXT);

  await reportAndScan(page, issues);
});

test('SECURITY: a script payload typed into Name and Message is submitted as inert text and never executes', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  const payload = '<script>alert(1)</script>';
  test.info().annotations.push({ type: 'test-data', description: `payload: ${payload}` });

  let dialogCount = 0;
  page.on('dialog', async d => { dialogCount++; await d.dismiss(); });

  await openContact(page);
  await fillAll(page, payload, `test.${Date.now()}@example.com`, payload);
  await expect(nameInput(page)).toHaveValue(payload);
  await sendButton(page).click();

  await expect(resultMessage(page)).toHaveText(SUCCESS_TEXT);
  await expect(page.locator('main script')).toHaveCount(0);
  await expect(resultMessage(page).locator('script')).toHaveCount(0);
  expect(dialogCount).toBe(0);

  await reportAndScan(page, issues);
});

test('STATE: the Send button is enabled even while the form is empty, and the success message is not shown before submitting', async ({ page }) => {
  const issues = trackRuntimeIssues(page);
  await openContact(page);

  await expect(sendButton(page)).toBeEnabled();
  await expect(resultMessage(page)).toBeEmpty();

  await fillAll(page, 'Button Tester', `test.${Date.now()}@example.com`, 'Some message');
  await expect(sendButton(page)).toBeEnabled();

  await reportAndScan(page, issues);
});