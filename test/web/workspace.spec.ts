import { test, expect } from '@playwright/test';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

let agent: TestAgent;

test.beforeAll(async () => {
  agent = await startTestAgent();
});

test.afterAll(async () => {
  if (agent) {
    await agent.cleanup();
  }
});

test.describe('Web UI', () => {
  test('loads dashboard page', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Workspaces');
  });

  test('shows empty workspace list', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await expect(page.getByText('No workspaces yet')).toBeVisible({ timeout: 15000 });
  });

  test('can navigate to settings', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings`);
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 15000 });
  });
});

test.describe('Web UI - Workspace Operations', () => {
  let workspaceName: string;

  test.beforeEach(() => {
    workspaceName = generateTestWorkspaceName();
  });

  test.afterEach(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {}
  });

  test('shows created workspace in list', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 30000 });
  }, 120000);

  test('can open workspace detail page', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
    await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });
  }, 120000);
});
