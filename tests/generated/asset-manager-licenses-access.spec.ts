import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Credentials of the role under test come from the run's own answers -- never from a literal.
const ASSET_MANAGER_USERNAME = process.env.HITL_ROLE_ASSET_MANAGER_USERNAME ?? '';
const ASSET_MANAGER_PASSWORD = process.env.HITL_ROLE_ASSET_MANAGER_PASSWORD ?? '';

/** Collect console errors, page errors, failed requests and HTTP >= 400 responses. */
function attachDiagnostics(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });
  return errors;
}

/** Real sign-in of this app: /login, inputs named username/password, submit button "Login". */
async function signInAsAssetManager(page: Page) {
  await page.goto('login', { waitUntil: 'domcontentloaded' });
  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 20000 });
  await usernameInput.fill(ASSET_MANAGER_USERNAME);
  await page.locator('input[name="password"]').fill(ASSET_MANAGER_PASSWORD);
  const startUrl = page.url();
  await page.locator('button[type="submit"]:has-text("Login")').filter({ visible: true }).first().click();
  await page.waitForURL(url => url.toString() !== startUrl, { timeout: 30000 });
}

const topNav = (page: Page) => page.getByRole('navigation').first();
const navLicensesLink = (page: Page) => topNav(page).locator('a[href$="/licenses"]');
const licensesTable = (page: Page) => page.getByRole('table', { name: 'Licenses' });
const signInPasswordField = (page: Page) => page.locator('input[name="password"]');
const refusalText = (page: Page) =>
  page.getByText(/permission|forbidden|not allowed|not authori[sz]ed|unauthori[sz]ed|access denied|restricted|403/i).first();

test.describe('Asset manager role cannot open Licenses', () => {
  // This journey is about a role that is not the default saved user, so every test starts signed out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('POSITIVE: Asset manager signs in and the Licenses module is missing from their menu', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = attachDiagnostics(page);

    await signInAsAssetManager(page);
    test.info().annotations.push({ type: 'test-data', description: 'signed in as the Asset manager role user (credentials from environment)' });

    // proof the sign-in really happened: dashboard + the signed-in asset-tag search box
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 25000 });
    await expect(page.getByRole('textbox', { name: 'Lookup by Asset Tag' })).toBeVisible({ timeout: 15000 });

    // the restricted module is not offered in the menu at all
    await expect(navLicensesLink(page).first()).toBeHidden();

    // a module this role may use still opens normally
    await expect(async () => {
      await topNav(page).locator('a[href$="/hardware"]').filter({ visible: true }).first().click();
      await expect(page).toHaveURL(/hardware/, { timeout: 3000 });
    }).toPass({ timeout: 25000 });
    await expect(page.getByRole('heading', { name: 'Assets', level: 3 })).toBeVisible({ timeout: 25000 });

    await expect(page.getByRole('main')).toMatchAriaSnapshot(`
      - heading "Assets"
      - searchbox "Search"
    `);

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });

  test('NEGATIVE: Asset manager is refused when opening Licenses by its address', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = attachDiagnostics(page);

    await signInAsAssetManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 25000 });

    // the role user types the restricted address by hand
    await page.goto('licenses', { waitUntil: 'domcontentloaded' });

    // accepted refusals: a permission/forbidden message, the sign-in form, or being moved to another page.
    const refusals: string[] = [];
    const refusalVisible = await refusalText(page).or(signInPasswordField(page)).first()
      .waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
    if (refusalVisible) refusals.push('refusal message or sign-in form shown');
    const movedAway = !/\/licenses(\/|\?|$)/i.test(page.url());
    if (movedAway) refusals.push(`moved away from /licenses to ${new URL(page.url()).pathname}`);
    test.info().annotations.push({ type: 'observed-limit', description: refusals.join(' | ') || 'no refusal signal observed' });

    expect(refusalVisible || movedAway, 'opening /licenses must be refused (permission message, sign-in page, or a redirect away)').toBeTruthy();

    // and none of the Licenses page's own content is rendered
    await expect(licensesTable(page)).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search' }).or(page.getByRole('button', { name: 'Columns' })).first()).toBeHidden();

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });

  test('VALIDATION: sign-in is refused when a required field is left empty', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = attachDiagnostics(page);

    // The sign-in form's own required fields, as rendered: username and password.
    const requiredFields = ['username', 'password'];

    for (const fieldName of requiredFields) {
      await page.goto('login', { waitUntil: 'domcontentloaded' });

      const usernameInput = page.locator('input[name="username"]');
      const passwordInput = signInPasswordField(page);
      await usernameInput.waitFor({ state: 'visible', timeout: 20000 });

      // everything valid except the one field under test
      await usernameInput.fill(fieldName === 'username' ? '' : ASSET_MANAGER_USERNAME);
      await passwordInput.fill(fieldName === 'password' ? '' : ASSET_MANAGER_PASSWORD);

      await expect(page.locator(`input[name="${fieldName}"]`)).toHaveValue('');

      await page.locator('button[type="submit"]:has-text("Login")').filter({ visible: true }).first().click();

      // the empty required field is reported -- either by the browser on the field itself,
      // or by the app's own error box
      const nativeInvalid = page.locator(`input[name="${fieldName}"]:invalid`).first();
      const appError = page.locator('.alert-danger, .invalid-feedback, .has-error .help-block').first();
      await expect(appError.or(nativeInvalid).first()).toBeVisible({ timeout: 15000 });

      // and it never signs anybody in
      await expect(page).toHaveURL(/login/, { timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
      await expect(navLicensesLink(page).first()).toBeHidden();
    }

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });

  test('SECURITY: Licenses cannot be opened while signed out', async ({ page }) => {
    test.setTimeout(60000);
    const consoleErrors = attachDiagnostics(page);

    await page.goto('licenses', { waitUntil: 'domcontentloaded' });

    // the app really blocks it: the sign-in form is what a visitor gets, not the license list
    await expect(signInPasswordField(page)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Please Login' })).toBeVisible();
    await expect(page).toHaveURL(/login/);
    await expect(licensesTable(page)).toHaveCount(0);
    await expect(page.locator('input[name="username"]')).toBeVisible();

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });

  test('BOUNDARY: an over-long username is refused at sign-in', async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors = attachDiagnostics(page);

    // No documented length limit is visible for the username box, so this is the generic
    // extreme input: a 500-character username cannot belong to the role account.
    const longUsername = 'a'.repeat(500);
    test.info().annotations.push({ type: 'test-data', description: `username length typed: ${longUsername.length}` });

    await page.goto('login', { waitUntil: 'domcontentloaded' });
    const usernameInput = page.locator('input[name="username"]');
    await usernameInput.waitFor({ state: 'visible', timeout: 20000 });

    const declaredMaxLength = await usernameInput.evaluate(el => (el as HTMLInputElement).maxLength);
    await usernameInput.fill(longUsername);
    const keptLength = (await usernameInput.inputValue()).length;
    test.info().annotations.push({
      type: 'observed-limit',
      description: `username maxlength attribute: ${declaredMaxLength}; field kept ${keptLength} of ${longUsername.length} characters`,
    });

    await signInPasswordField(page).fill(ASSET_MANAGER_PASSWORD);
    await page.locator('button[type="submit"]:has-text("Login")').filter({ visible: true }).first().click();

    // the app refuses the extreme value instead of signing in
    const loginFormBack = signInPasswordField(page);
    const rejectionText = page.getByText(/required|invalid|too long|may not be greater|do not match|not match/i).first();
    await expect(loginFormBack.or(rejectionText).first()).toBeVisible({ timeout: 25000 });

    await expect(page).toHaveURL(/login/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
    await expect(navLicensesLink(page).first()).toBeHidden();

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).setLegacyMode().analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });
});