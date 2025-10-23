// tests/playwright/GmailIntegrationCard.spec.ts
// Purpose: Playwright end-to-end tests covering GmailIntegrationCard connect and disconnect flows.

import { expect, test } from 'playwright/test';

test.describe('Gmail integration dashboard card', () => {
  test('disables connect button and shows redirecting feedback', async ({ page }) => {
    await page.goto('/testing/gmail-integration?connected=false');

    const connectButton = page.getByRole('button', { name: 'Connect Gmail' });
    await expect(connectButton).toBeEnabled();

    await connectButton.click();

    await expect(connectButton).toBeDisabled();
    await expect(connectButton).toHaveText('Redirecting…');
    await expect(page.locator('body')).toHaveAttribute('data-gmail-navigate', '/test/connect');
  });

  test('shows disconnect progress, success alert, and refreshed status', async ({ page }) => {
    await page.route('**/api/testing/gmail/disconnect', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.goto('/testing/gmail-integration?connected=true');

    const disconnectButton = page.getByRole('button', { name: 'Disconnect' });
    await disconnectButton.click();

    await expect(disconnectButton).toBeDisabled();
    await expect(disconnectButton).toHaveText('Disconnecting…');

    const successAlert = page.getByTestId('gmail-success-alert');
    await expect(successAlert).toBeVisible();
    await expect(page.getByText('Not connected')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-gmail-disconnect-count', '1');
    await expect(successAlert).toBeHidden({ timeout: 6000 });

    const connectButton = page.getByRole('button', { name: 'Connect Gmail' });
    await expect(connectButton).toBeEnabled();
  });
});
