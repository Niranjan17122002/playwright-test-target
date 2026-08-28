import { test, expect } from '@playwright/test';

test('POSITIVE: Contact page renders and a valid contact form submission succeeds', async ({ page }) => {
  await page.goto('contact.html', { waitUntil: 'domcontentloaded' });

  // The page heading must render
  await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();

  // The contact form and all of its fields must render
  const form = page.locator('#contact-form');
  await expect(form).toBeVisible();

  const nameInput = page.locator('#name');
  const emailInput = page.locator('#email');
  const messageTextarea = page.locator('#message');
  const submitButton = page.locator('#contact-submit');

  await expect(nameInput).toBeVisible();
  await expect(emailInput).toBeVisible();
  await expect(messageTextarea).toBeVisible();
  await expect(submitButton).toBeVisible();

  // Use non-literal test data; email comes from env when available so no real credential is committed
  const name = `Test User ${Date.now()}`;
  const email = process.env.APP_USERNAME ?? `contact.${Date.now()}@example.com`;
  const message = `Automated contact message ${Date.now()}`;

  test.info().annotations.push({ type: 'test-data', description: `name: ${name}` });
  test.info().annotations.push({ type: 'test-data', description: `email: ${email}` });

  await nameInput.fill(name);
  await emailInput.fill(email);
  await messageTextarea.fill(message);

  await submitButton.click();

  // Success signal: the confirmation message appears and the form is reset
  await expect(page.locator('#contact-message')).toHaveText('Thanks! Your message has been sent.');
  await expect(nameInput).toHaveValue('');
  await expect(emailInput).toHaveValue('');
});

test('NEGATIVE: An invalid email is rejected and the contact message is not sent', async ({ page }) => {
  await page.goto('contact.html', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();

  const nameInput = page.locator('#name');
  const emailInput = page.locator('#email');
  const messageTextarea = page.locator('#message');
  const submitButton = page.locator('#contact-submit');

  await nameInput.fill('Test User');
  // Obviously-fake value: never a real credential, and it fails email-format validation
  await emailInput.fill('WrongPassword123!');
  await messageTextarea.fill('This message must not be sent.');

  await submitButton.click();

  // Native HTML5 constraint validation blocks the submit: no success message appears,
  // the invalid value stays in the field, and the form remains on the page
  await expect(page.locator('#contact-message')).not.toContainText('Thanks!');
  await expect(emailInput).toHaveValue('WrongPassword123!');
  await expect(page.locator('#contact-form')).toBeVisible();
});