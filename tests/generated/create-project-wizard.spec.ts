import { test, expect } from '@playwright/test';

// The Create Project Wizard (wizard.html) is a public static page with no
// authentication gate, so this journey's valid/invalid input axis is the
// wizard's own required 'Project name' field rather than login credentials.
// No real literal username/email/password appears anywhere in this file.

test.describe('Create Project Wizard', () => {

  test('POSITIVE: Complete the Create Project wizard with valid inputs and verify the success message', async ({ page }) => {
    test.setTimeout(120000);

    const projectName = `QA Project ${Date.now()}`;
    const environment = 'production';
    const description = 'Project created by an automated end-to-end run through the Create Project wizard.';
    test.info().annotations.push({ type: 'test-data', description: `project name: ${projectName}` });

    // Open the site home page
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    // Click the 'Create Project Wizard' module card in the Modules grid
    await page.locator('#link-wizard').click();
    await page.waitForURL((url) => url.pathname.endsWith('wizard.html'), { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
    await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');

    // Step 1: enter the required project name and advance
    await page.locator('#wizard-project-name').fill(projectName);
    await page.locator('#wizard-next-1').click();
    await expect(page.locator('#wizard-progress')).toHaveText('Step 2 of 3');
    await expect(page.locator('#wizard-environment')).toBeVisible();

    // Step 2: choose an environment and add a description
    await page.selectOption('#wizard-environment', environment);
    await page.locator('#wizard-description').fill(description);
    await page.locator('#wizard-next-2').click();
    await expect(page.locator('#wizard-progress')).toHaveText('Step 3 of 3');

    // Step 3: review the entered details
    await expect(page.locator('#wizard-review-name')).toHaveText(projectName);
    await expect(page.locator('#wizard-review-environment')).toHaveText(environment);
    await expect(page.locator('#wizard-review-description')).toHaveText(description);

    // Finish the wizard and verify the completion state
    await page.locator('#wizard-finish').click();
    await expect(page.locator('#wizard-success-message')).toBeVisible();
    await expect(page.locator('#wizard-success-message')).toHaveText(`Project "${projectName}" created successfully.`);
  });

  test('NEGATIVE: Invalid (empty) project name is rejected on step 1', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('wizard.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
    await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');

    // Attempt to advance without providing a project name
    await page.locator('#wizard-next-1').click();

    await expect(page.locator('#wizard-step-1-error')).toBeVisible();
    await expect(page.locator('#wizard-step-1-error')).toHaveText('Project name is required.');
    // The wizard must remain on step 1
    await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');
    await expect(page.locator('#wizard-step-1')).toHaveClass(/active/);
    await expect(page.locator('#wizard-step-2')).not.toHaveClass(/active/);
  });

  test('BOUNDARY: Whitespace-only project name is treated as empty and rejected', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('wizard.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#wizard-project-name')).toBeVisible();

    // The wizard trims input, so whitespace-only counts as empty
    await page.locator('#wizard-project-name').fill('   ');
    await page.locator('#wizard-next-1').click();

    await expect(page.locator('#wizard-step-1-error')).toBeVisible();
    await expect(page.locator('#wizard-step-1-error')).toHaveText('Project name is required.');
    await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3');
    await expect(page.locator('#wizard-step-2')).not.toHaveClass(/active/);
  });
});