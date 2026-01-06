import { test, expect } from './fixtures';
import { generateTestWorkspaceName } from '../helpers/agent';

test.describe('Web UI', () => {
  test('loads dashboard page', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('shows empty workspace list', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await expect(page.getByText('No workspaces yet')).toBeVisible({ timeout: 15000 });
  });

  test('can navigate to settings', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings`);
    await expect(page.locator('h1')).toContainText('Environment', { timeout: 15000 });
  });
});

test.describe('Web UI - Workspace Operations', () => {
  test('shows created workspace in list', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can open workspace detail page', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /sessions/i })).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('shows workspace status indicators', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Running').first()).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can stop workspace from detail page', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });

      const stopButton = page.getByRole('button', { name: /stop/i });
      await stopButton.click();

      await expect(page.getByText('stopped').first()).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});

test.describe('Web UI - Settings Pages', () => {
  test('environment settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/environment`);
    await expect(page.locator('h1')).toContainText('Environment', { timeout: 15000 });
  });

  test('agents settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/agents`);
    await expect(page.locator('h1')).toContainText('Configuration', { timeout: 15000 });
  });

  test('files settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/files`);
    await expect(page.locator('h1')).toContainText('Files', { timeout: 15000 });
  });

  test('scripts settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/scripts`);
    await expect(page.locator('h1')).toContainText('Scripts', { timeout: 15000 });
  });
});

test.describe('Web UI - Terminal', () => {
  test('can open terminal tab and interact', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });

      const terminalTab = page.getByRole('button', { name: /terminal/i });
      await terminalTab.click();

      const terminalScreen = page.locator('[data-testid="terminal-screen"]');
      await expect(terminalScreen).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(2000);

      await terminalScreen.click();
      await page.keyboard.type('echo test', { delay: 50 });
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can navigate directly to terminal via tab param', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=terminal`);

      const terminalScreen = page.locator('[data-testid="terminal-screen"]');
      await expect(terminalScreen).toBeVisible({ timeout: 15000 });

      const sessionsTab = page.getByRole('button', { name: /sessions/i });
      await sessionsTab.click();

      await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 10000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});

test.describe('Web UI - Sessions', () => {
  test('workspace shows stopped state message when not running', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });
    await agent.api.stopWorkspace(workspaceName);

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.getByText('Workspace is stopped')).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions tab loads for running workspace', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);
      await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions tab has agent filter dropdown', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);
      await expect(page.getByRole('button', { name: /all agents/i })).toBeVisible({
        timeout: 30000,
      });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions tab has new chat dropdown', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);
      await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions list shows prompt and clicking opens chat directly', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    const sessionId = `test-session-${Date.now()}`;
    const filePath = `/home/workspace/.claude/projects/-workspace/${sessionId}.jsonl`;
    const sessionContent = [
      '{"type":"user","message":{"role":"user","content":"Hello from test"},"timestamp":"2026-01-01T00:00:00.000Z"}',
      '{"type":"assistant","message":{"role":"assistant","content":"Hi there"},"timestamp":"2026-01-01T00:00:01.000Z"}',
    ].join('\n');

    await agent.api.createWorkspace({ name: workspaceName });
    await agent.exec(
      workspaceName,
      `mkdir -p /home/workspace/.claude/projects/-workspace && cat <<'EOF' > "${filePath}"\n${sessionContent}\nEOF`
    );

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);
      const sessionItem = page
        .getByTestId('session-list-item')
        .filter({ hasText: 'Hello from test' })
        .first();
      await expect(sessionItem).toBeVisible({ timeout: 30000 });

      await sessionItem.click();

      await expect(page.getByText('Claude Code')).toBeVisible({ timeout: 30000 });
      await expect(page.getByPlaceholder('Send a message...')).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('clicking session loads conversation history', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    const sessionId = `history-test-${Date.now()}`;
    const filePath = `/home/workspace/.claude/projects/-workspace/${sessionId}.jsonl`;
    const sessionContent = [
      '{"type":"user","message":{"role":"user","content":"What is 2+2?"},"timestamp":"2026-01-01T00:00:00.000Z"}',
      '{"type":"assistant","message":{"role":"assistant","content":"2+2 equals 4"},"timestamp":"2026-01-01T00:00:01.000Z"}',
      '{"type":"user","message":{"role":"user","content":"Thanks!"},"timestamp":"2026-01-01T00:00:02.000Z"}',
      '{"type":"assistant","message":{"role":"assistant","content":"You are welcome!"},"timestamp":"2026-01-01T00:00:03.000Z"}',
    ].join('\n');

    await agent.api.createWorkspace({ name: workspaceName });
    await agent.exec(
      workspaceName,
      `mkdir -p /home/workspace/.claude/projects/-workspace && cat <<'EOF' > "${filePath}"\n${sessionContent}\nEOF`
    );

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);
      const sessionItem = page
        .getByTestId('session-list-item')
        .filter({ hasText: 'What is 2+2?' })
        .first();
      await expect(sessionItem).toBeVisible({ timeout: 30000 });

      await sessionItem.click();

      await expect(page.getByText('Claude Code')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('2+2 equals 4')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Thanks!')).toBeVisible();
      await expect(page.getByText('You are welcome!')).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('clicking new chat opens chat UI', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);

      await page.getByRole('button', { name: /new chat/i }).click();
      await page.getByText('Claude Code').first().click();

      await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});
