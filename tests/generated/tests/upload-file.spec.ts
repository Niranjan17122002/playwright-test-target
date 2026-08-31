import { test, expect } from '@playwright/test';

test('POSITIVE: Upload a file and verify the upload result', async ({ page }) => {
  test.setTimeout(120000);

  const fileName = `test-upload-${Date.now()}.txt`;
  test.info().annotations.push({ type: 'test-data', description: `file: ${fileName}` });

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-upload').click();

  const heading = page.getByRole('heading', { name: 'Upload a File' });
  await heading.waitFor({ state: 'visible', timeout: 15000 });

  const fileInput = page.locator('#file-input');
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('playwright upload test content'),
  });

  await page.locator('#upload-submit').click();

  await expect(page.locator('#upload-message')).toHaveText(`Uploaded: ${fileName}`);
  await expect(page.locator('#upload-message')).toHaveClass(/success/);
  await expect(page.locator('#uploaded-files-list li').first()).toContainText(fileName);
});

test('NEGATIVE: Submitting the upload form without a file shows an error', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#link-upload').click();

  const heading = page.getByRole('heading', { name: 'Upload a File' });
  await heading.waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('#upload-submit').click();

  await expect(page.locator('#upload-message')).toHaveText('Please choose a file first.');
  await expect(page.locator('#upload-message')).toHaveClass(/error/);
  await expect(page.locator('#uploaded-files-list li')).toHaveCount(0);
});