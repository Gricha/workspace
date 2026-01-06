import { test, expect } from '@playwright/test';

test.describe('OpenCode Chat', () => {
  test('should send first message and receive response', async ({ page }) => {
    const wsMessages: string[] = [];

    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        wsMessages.push(frame.payload as string);
      });
    });

    await page.goto('/workspaces/test?tab=sessions');
    await page.waitForTimeout(1000);

    const newChatButton = page.locator('button:has-text("New Chat")');
    if (!(await newChatButton.isVisible())) {
      test.skip();
      return;
    }

    await newChatButton.click();
    await page.waitForTimeout(500);

    const opencodeOption = page.locator('text=OpenCode').first();
    if (!(await opencodeOption.isVisible())) {
      test.skip();
      return;
    }

    await opencodeOption.click();
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea[placeholder="Send a message..."]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('Say "hello" and nothing else');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(15000);

    const assistantMessages = wsMessages.filter((m) => {
      try {
        const parsed = JSON.parse(m);
        return parsed.type === 'assistant';
      } catch {
        return false;
      }
    });

    const errorMessages = wsMessages.filter((m) => {
      try {
        const parsed = JSON.parse(m);
        return parsed.type === 'error';
      } catch {
        return false;
      }
    });

    expect(errorMessages.length).toBe(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });
});
