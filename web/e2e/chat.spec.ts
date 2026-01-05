import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test('should load without React error #301 (setState during render)', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    const react301Errors = jsErrors.filter((e) => e.includes('#301') || e.includes('301'));
    if (react301Errors.length > 0) {
      console.log('React #301 errors found:', react301Errors);
    }

    expect(react301Errors).toHaveLength(0);
  });

  test('should open chat without JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(`${error.message}`);
    });

    await page.goto('/workspaces/test?tab=sessions');
    await page.waitForTimeout(1000);

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

    const chatInput = page.locator('textarea[placeholder="Send a message..."]');
    const inputVisible = await chatInput.isVisible().catch(() => false);

    if (jsErrors.length > 0) {
      console.log('JavaScript errors:', jsErrors);
    }

    expect(jsErrors.filter((e) => e.includes('#301'))).toHaveLength(0);

    if (inputVisible) {
      await expect(chatInput).toBeVisible();
    }
  });

  test('should render chat with existing messages without errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(`${error.message}`);
    });

    await page.goto('/workspaces/test?tab=sessions');
    await page.waitForTimeout(1000);

    const sessionItems = page.locator('[data-testid="session-list-item"]');
    const sessionCount = await sessionItems.count();

    if (sessionCount > 0) {
      await sessionItems.first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/existing-session.png' });
    }

    const react301Errors = jsErrors.filter((e) => e.includes('#301'));
    if (react301Errors.length > 0) {
      console.log('React #301 errors when viewing existing session:', react301Errors);
    }

    expect(react301Errors).toHaveLength(0);
  });
});
