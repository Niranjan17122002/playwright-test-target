import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Weekly report (flaky.html)', () => {
  test('POSITIVE: clicking "Load report" shows the loaded report status', async ({ page }) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
    page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });

    // The page answers instantly or after 7s at random. ?speed=slow forces the slow path
    // so the test deterministically exercises "wait for the real final status".
    await page.goto('flaky.html?speed=slow', { waitUntil: 'domcontentloaded' });

    const status = page.locator('#report-status');
    await expect(status).toBeAttached();

    await page.getByRole('button', { name: 'Load report' }).click();

    // The report server is sometimes slow -- wait for the actual final status instead of
    // assuming an immediate response.
    await expect(status).toContainText('Report loaded: 42 rows', { timeout: 15000 });

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });

  test('NEGATIVE: the report is not reported as loaded without/while loading', async ({ page }) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('requestfailed', req => consoleErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`));
    page.on('response', res => { if (res.status() >= 400) consoleErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`); });

    await page.goto('flaky.html?speed=slow', { waitUntil: 'domcontentloaded' });

    const status = page.locator('#report-status');
    await expect(status).toBeAttached();

    // Without the required user action (the trigger click), the app must not claim a report is loaded.
    await expect(status).toHaveText('');
    await expect(status).not.toContainText('Report loaded');

    await page.getByRole('button', { name: 'Load report' }).click();

    // While the slow server is still working, the app must show the in-progress state and
    // must NOT falsely report the final result.
    await expect(status).toHaveText('Loading report...');
    await expect(status).not.toContainText('Report loaded: 42 rows');

    if (consoleErrors.length) test.info().annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });

    const axeResults = await new AxeBuilder({ page }).analyze();
    if (axeResults.violations.length) {
      test.info().annotations.push({
        type: 'a11y-violations',
        description: axeResults.violations.map(v => `${v.id}: ${v.help}`).join(' | '),
      });
    }
  });
});