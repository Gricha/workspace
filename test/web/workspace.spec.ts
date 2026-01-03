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

  test('shows workspace status indicators', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('running')).toBeVisible();
  }, 120000);

  test('can stop workspace from detail page', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
    await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });

    const stopButton = page.getByRole('button', { name: /stop/i });
    await stopButton.click();

    await expect(page.getByText('stopped')).toBeVisible({ timeout: 30000 });
  }, 120000);
});

test.describe('Web UI - Settings Pages', () => {
  test('environment settings page loads', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/environment`);
    await expect(page.locator('h1')).toContainText('Environment', { timeout: 15000 });
  });

  test('agents settings page loads', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/agents`);
    await expect(page.getByText('Coding Agents')).toBeVisible({ timeout: 15000 });
  });

  test('files settings page loads', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/files`);
    await expect(page.getByText('Credential Files')).toBeVisible({ timeout: 15000 });
  });

  test('scripts settings page loads', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/scripts`);
    await expect(page.getByText('Scripts')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Web UI - Terminal', () => {
  let workspaceName: string;

  test.beforeEach(() => {
    workspaceName = generateTestWorkspaceName();
  });

  test.afterEach(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {}
  });

  test('can open terminal and type commands', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
    await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });

    const terminalButton = page.getByRole('button', { name: /terminal/i });
    await terminalButton.click();

    await expect(page.getByText('Connected to terminal')).toBeVisible({ timeout: 10000 });

    const terminalElement = page.locator('.xterm-helper-textarea');
    await terminalElement.focus();

    await page.keyboard.type('echo hello-from-test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.xterm').getByText('hello-from-test')).toBeVisible({
      timeout: 10000,
    });
  }, 120000);
});

test.describe('Web UI - Sessions', () => {
  let workspaceName: string;

  test.beforeEach(() => {
    workspaceName = generateTestWorkspaceName();
  });

  test.afterEach(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {}
  });

  test('sessions page shows workspace not running message when stopped', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });
    await agent.api.stopWorkspace(workspaceName);

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
    await expect(page.getByText('Workspace is not running')).toBeVisible({ timeout: 30000 });
  }, 120000);

  test('sessions page loads for running workspace', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
    await expect(page.locator('h1')).toContainText('Sessions', { timeout: 30000 });
  }, 120000);

  test('sessions page has agent filter dropdown', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
    await expect(page.getByRole('button', { name: /all agents/i })).toBeVisible({ timeout: 30000 });
  }, 120000);

  test('sessions page has new chat dropdown', async ({ page }) => {
    await agent.api.createWorkspace({ name: workspaceName });

    await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 30000 });
  }, 120000);
});
