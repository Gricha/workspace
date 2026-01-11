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
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=settings`);
      await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 30000 });

      const stopButton = page.getByRole('button', { name: /^stop$/i });
      await stopButton.click();

      await expect(page.getByText('stopped').first()).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});

test.describe('Web UI - Create Workspace', () => {
  test('create workspace form shows name and repo inputs', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await page.waitForLoadState('networkidle');

    const newWorkspaceButton = page.getByRole('button', { name: /new workspace/i });
    await newWorkspaceButton.click();

    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('my-project')).toBeVisible();
    await expect(page.getByPlaceholder('https://github.com/user/repo')).toBeVisible();
  });

  test('repo selector allows manual URL entry', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await page.waitForLoadState('networkidle');

    const newWorkspaceButton = page.getByRole('button', { name: /new workspace/i });
    await newWorkspaceButton.click();

    const repoInput = page.getByPlaceholder('https://github.com/user/repo');
    await expect(repoInput).toBeVisible({ timeout: 10000 });

    await repoInput.fill('https://github.com/test/repo');
    await expect(repoInput).toHaveValue('https://github.com/test/repo');
  });
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
      '{"type":"user","content":"Hello from test","timestamp":"2026-01-01T00:00:00.000Z"}',
      '{"type":"assistant","content":"Hi there","timestamp":"2026-01-01T00:00:01.000Z"}',
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

      await expect(page.getByText('Claude Code', { exact: true })).toBeVisible({ timeout: 30000 });
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
      '{"type":"user","message":{"content":"What is 2+2?"},"timestamp":"2026-01-01T00:00:00.000Z"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"2+2 equals 4"}]},"timestamp":"2026-01-01T00:00:01.000Z"}',
      '{"type":"user","message":{"content":"Thanks!"},"timestamp":"2026-01-01T00:00:02.000Z"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"You are welcome!"}]},"timestamp":"2026-01-01T00:00:03.000Z"}',
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

      await expect(page.getByText('Claude Code', { exact: true })).toBeVisible({ timeout: 30000 });
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

  test('resuming session sends projectPath in WebSocket connect message', async ({
    agent,
    page,
  }) => {
    const workspaceName = generateTestWorkspaceName();
    const sessionId = `project-path-test-${Date.now()}`;
    const projectDir = '-home-workspace-myproject';
    const expectedProjectPath = '/home/workspace/myproject';
    const filePath = `/home/workspace/.claude/projects/${projectDir}/${sessionId}.jsonl`;
    const sessionContent = [
      '{"type":"user","message":{"content":"Test message"},"timestamp":"2026-01-01T00:00:00.000Z"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Test response"}]},"timestamp":"2026-01-01T00:00:01.000Z"}',
    ].join('\n');

    await agent.api.createWorkspace({ name: workspaceName });
    await agent.exec(
      workspaceName,
      `mkdir -p /home/workspace/.claude/projects/${projectDir} && cat <<'EOF' > "${filePath}"\n${sessionContent}\nEOF`
    );

    try {
      let capturedConnectMessage: { sessionId?: string; projectPath?: string } | null = null;

      page.on('websocket', (ws) => {
        ws.on('framesent', (frame) => {
          try {
            const data = JSON.parse(frame.payload as string);
            if (data.type === 'connect' && ws.url().includes('/rpc/live/claude/')) {
              capturedConnectMessage = data;
            }
          } catch {
            // Ignore non-JSON frames
          }
        });
      });

      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?tab=sessions`);

      const sessionItem = page
        .getByTestId('session-list-item')
        .filter({ hasText: 'Test message' })
        .first();
      await expect(sessionItem).toBeVisible({ timeout: 30000 });

      await sessionItem.click();

      await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 30000 });

      await page.waitForTimeout(1000);

      expect(capturedConnectMessage).not.toBeNull();
      expect(capturedConnectMessage?.sessionId).toBeTruthy();
      expect(capturedConnectMessage?.projectPath).toBe(expectedProjectPath);
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});
