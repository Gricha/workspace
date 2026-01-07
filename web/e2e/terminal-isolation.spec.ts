import { test, expect } from '@playwright/test';

test.describe('Terminal Session Isolation', () => {
  test('rapid tab switching within same workspace', async ({ page }) => {
    await page.goto('/workspaces/test?tab=terminal');
    await page.waitForTimeout(3000);

    const terminalContainer = page.locator('[data-testid="terminal-container"]');
    await terminalContainer.click();
    await page.waitForTimeout(300);

    await page.keyboard.type('echo "RAPID_SWITCH_TEST"', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/rapid-1-terminal-with-text.png', fullPage: true });

    const sessionsTab = page.locator('button:has-text("Sessions")');
    await sessionsTab.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'test-results/rapid-2-sessions-tab.png', fullPage: true });

    const terminalTab = page.locator('button:has-text("Terminal")');
    await terminalTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/rapid-3-back-to-terminal.png', fullPage: true });

    for (let i = 0; i < 3; i++) {
      await sessionsTab.click();
      await page.waitForTimeout(200);
      await terminalTab.click();
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/rapid-4-after-rapid-switch.png', fullPage: true });
  });
});
