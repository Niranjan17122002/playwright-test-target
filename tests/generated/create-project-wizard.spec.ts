import { test, expect } from '@playwright/test';

test('POSITIVE: Complete the Create Project Wizard with valid project details', async ({ page }) => {
  test.setTimeout(120000);

  const projectName = `QA Project ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `project name: ${projectName}` });
  const description = 'End-to-end wizard validation flow';

  // Open the home page and navigate to the wizard via the module card
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await page.waitForURL('**/wizard.html', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');

  // Step 1: required project name
  await page.locator('#wizard-project-name').fill(projectName);
  await page.locator('#wizard-next-1').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');

  // Step 2: environment and optional description
  await page.locator('#wizard-environment').selectOption('production');
  await page.locator('#wizard-description').fill(description);
  await page.locator('#wizard-next-2').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 3 of 3');

  // Step 3: review reflects the entered values (environment shows the raw select value)
  await expect(page.locator('#wizard-review-name')).toHaveText(projectName);
  await expect(page.locator('#wizard-review-environment')).toHaveText('production');
  await expect(page.locator('#wizard-review-description')).toHaveText(description);

  // Finish and verify the success message
  await page.locator('#wizard-finish').click();
  const successMessage = page.locator('#wizard-success-message');
  await expect(successMessage).toHaveClass(/success/);
  await expect(successMessage).toHaveText(`Project "${projectName}" created successfully.`);
});

test('NEGATIVE: Reject advancing past step 1 without a project name', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await page.waitForURL('**/wizard.html', { timeout: 15000 });

  // Error is hidden before the attempt
  await expect(page.locator('#wizard-step-1-error')).toBeHidden();

  // Click Next without entering a project name
  await page.locator('#wizard-next-1').click();

  await expect(page.locator('#wizard-step-1-error')).toBeVisible();
  await expect(page.locator('#wizard-step-1-error')).toHaveText('Project name is required.');
  await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');
  await expect(page.locator('#wizard-step-2')).not.toBeVisible();
});

test('BOUNDARY: Preserve a very long project name through review and success', async ({ page }) => {
  test.setTimeout(120000);

  const longName = `P${'x'.repeat(298)}`;
  test.info().annotations.push({ type: 'test-data', description: `project name length: ${longName.length}` });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await page.waitForURL('**/wizard.html', { timeout: 15000 });

  await page.locator('#wizard-project-name').fill(longName);
  await page.locator('#wizard-next-1').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');

  // Keep the default environment and leave the description empty
  await page.locator('#wizard-next-2').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 3 of 3');
  await expect(page.locator('#wizard-review-name')).toHaveText(longName);

  await page.locator('#wizard-finish').click();
  await expect(page.locator('#wizard-success-message')).toContainText(longName);
});

test('VALIDATION: Optional description defaults and Back navigation preserves entered data', async ({ page }) => {
  test.setTimeout(120000);

  const projectName = `Validation Project ${Date.now()}`;
  test.info().annotations.push({ type: 'test-data', description: `project name: ${projectName}` });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-wizard').click();
  await page.waitForURL('**/wizard.html', { timeout: 15000 });

  await page.locator('#wizard-project-name').fill(projectName);
  await page.locator('#wizard-next-1').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');

  // Description left empty; environment defaults to Staging
  await expect(page.locator('#wizard-environment')).toHaveValue('staging');
  await page.locator('#wizard-next-2').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 3 of 3');

  await expect(page.locator('#wizard-review-description')).toHaveText('(none)');
  await expect(page.locator('#wizard-review-environment')).toHaveText('staging');

  // Back from review returns to step 2 with the description still empty
  await page.locator('#wizard-back-3').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');
  await expect(page.locator('#wizard-description')).toHaveValue('');

  // Back from step 2 returns to step 1 with the project name preserved
  await page.locator('#wizard-back-2').click();
  await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');
  await expect(page.locator('#wizard-project-name')).toHaveValue(projectName);
});