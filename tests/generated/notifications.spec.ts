import { test, expect } from '@playwright/test';

test.describe('View Notifications', () => {
  test('POSITIVE: View Notifications module and verify notification items are displayed', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.locator('#link-notifications').click();
    await page.waitForURL(url => url.pathname.endsWith('notifications.html'));

    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();

    await page.locator('#show-notification-btn').click();

    const historyItem = page.locator('#notification-log .list-item').first();
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toContainText('Notification #');

    const toast = page.locator('#toast-container .toast').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Notification #');

    await expect(page.locator('#notification-log-empty')).toBeHidden();
  });

  test('NEGATIVE: Notification history shows empty state when no notifications have been generated', async ({ page }) => {
    await page.goto('notifications.html', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.locator('#notification-log-empty')).toBeVisible();
    await expect(page.locator('#notification-log .list-item')).toHaveCount(0);
  });
});