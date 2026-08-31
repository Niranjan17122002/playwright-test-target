import { test, expect } from '@playwright/test';

test.describe('Contact inquiry', () => {
  test('POSITIVE: Submit a contact inquiry with valid details', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.locator('#nav-contact').click();
    await page.waitForURL((url) => url.toString().includes('contact.html'), { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();

    const name = process.env.APP_USERNAME ?? 'Test User';
    const email = `test.${Date.now()}@example.com`;
    test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

    await page.locator('#name').fill(name);
    await page.locator('#email').fill(email);
    await page.locator('#message').fill('Hello! This is an automated test inquiry.');
    await page.locator('#contact-submit').click();

    await expect(page.locator('#contact-message')).toHaveText('Thanks! Your message has been sent.');
    await expect(page.locator('#contact-message')).toHaveClass('message success');
  });

  test('NEGATIVE: Contact form blocks an invalid email submission', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.locator('#nav-contact').click();
    await page.waitForURL((url) => url.toString().includes('contact.html'), { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();

    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#message').fill('This should not submit.');
    await page.locator('#contact-submit').click();

    await expect(page.locator('#contact-message')).toHaveText('');
    await expect(page.locator('#contact-message')).toHaveClass('message');
  });
});