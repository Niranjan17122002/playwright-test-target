import { test, expect } from '@playwright/test';

test('POSITIVE: Complete the Create Project Wizard', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await expect(page.locator('#wizard-step-1')).toBeVisible();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');

  const projectName = `Project ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `projectName: ${projectName}` });

  await page.locator('#wizard-project-name').fill(projectName);
  await page.locator('#wizard-next-1').click();
  await expect(page.locator('#wizard-step-2')).toBeVisible();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');

  await page.locator('#wizard-environment').selectOption('production');
  await page.locator('#wizard-description').fill('End-to-end wizard test project');
  await page.locator('#wizard-next-2').click();
  await expect(page.locator('#wizard-step-3')).toBeVisible();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 3 of 3');

  await expect(page.locator('#wizard-review-name')).toHaveText(projectName);
  await expect(page.locator('#wizard-review-environment')).toHaveText('production');
  await expect(page.locator('#wizard-review-description')).toHaveText('End-to-end wizard test project');

  await page.locator('#wizard-finish').click();
  await expect(page.locator('#wizard-success-message')).toBeVisible();
  await expect(page.locator('#wizard-success-message')).toHaveText(`Project "${projectName}" created successfully.`);
  await expect(page.locator('#wizard-success-message')).toHaveClass(/success/);
});

test('NEGATIVE: Project name is required', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await expect(page.locator('#wizard-step-1')).toBeVisible();

  await page.locator('#wizard-next-1').click();

  await expect(page.locator('#wizard-step-1-error')).toBeVisible();
  await expect(page.locator('#wizard-step-1-error')).toHaveText('Project name is required.');
  await expect(page.locator('#wizard-step-1')).toBeVisible();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');
});