import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test('should load chat page without JavaScript runtime errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    if (jsErrors.length > 0) {
      console.log('JavaScript runtime errors found:', jsErrors);
    }

    expect(jsErrors).toHaveLength(0);
  });

  test('should navigate to workspace and open chat without errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(`Page error: ${error.message}\n${error.stack}`);
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    const workspaceLinks = page.locator('[data-testid="workspace-card"]');
    const count = await workspaceLinks.count();
    console.log(`Found ${count} workspace cards`);

    if (count > 0) {
      await workspaceLinks.first().click();
      await page.waitForTimeout(1000);

      const sessionsTab = page.locator('button:has-text("Sessions")');
      if (await sessionsTab.isVisible()) {
        await sessionsTab.click();
        await page.waitForTimeout(500);
      }

      const newChatButton = page.locator('button:has-text("New Chat")');
      if (await newChatButton.isVisible()) {
        await newChatButton.click();
        await page.waitForTimeout(500);

        const claudeOption = page.locator('text=Claude Code').first();
        if (await claudeOption.isVisible()) {
          await claudeOption.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    if (jsErrors.length > 0) {
      console.log('JavaScript runtime errors found:', jsErrors);
    }

    expect(jsErrors).toHaveLength(0);
  });

  test('should render Chat component without virtualization errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(`${error.message}\n${error.stack}`);
    });

    await page.goto('/workspaces/test-chat-debug?tab=sessions');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/workspace-page.png' });

    const newChatButton = page.locator('button:has-text("New Chat")');
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      await page.waitForTimeout(500);

      const claudeOption = page.locator('text=Claude Code').first();
      if (await claudeOption.isVisible()) {
        await claudeOption.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'test-results/chat-page.png' });

    if (jsErrors.length > 0) {
      console.log('JavaScript errors on chat page:', jsErrors);
    }

    expect(jsErrors).toHaveLength(0);
  });
});
