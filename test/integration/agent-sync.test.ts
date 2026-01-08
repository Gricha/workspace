import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('Agent Sync Integration', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let tempHomeDir: string;

  beforeAll(async () => {
    tempHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-sync-test-'));

    await fs.mkdir(path.join(tempHomeDir, '.claude'), { recursive: true });
    await fs.writeFile(
      path.join(tempHomeDir, '.claude.json'),
      JSON.stringify({
        hasCompletedOnboarding: false,
        mcpServers: {
          'test-server': { command: 'node', args: ['test.js'] },
        },
      })
    );
    await fs.writeFile(
      path.join(tempHomeDir, '.claude', 'settings.json'),
      JSON.stringify({ theme: 'dark' })
    );

    await fs.mkdir(path.join(tempHomeDir, '.codex'), { recursive: true });
    await fs.writeFile(
      path.join(tempHomeDir, '.codex', 'auth.json'),
      JSON.stringify({ token: 'test-codex-token' })
    );
    await fs.writeFile(path.join(tempHomeDir, '.codex', 'config.toml'), 'model = "test"');

    await fs.mkdir(path.join(tempHomeDir, '.config', 'opencode'), { recursive: true });
    await fs.writeFile(
      path.join(tempHomeDir, '.config', 'opencode', 'opencode.json'),
      JSON.stringify({
        mcp: {
          'opencode-mcp': { type: 'local', command: ['bun', 'run', 'server'] },
        },
      })
    );

    agent = await startTestAgent({
      config: {
        agents: {
          opencode: { zen_token: 'test-zen-token' },
        },
      },
    });

    workspaceName = generateTestWorkspaceName();
    const createResult = await agent.api.createWorkspace({ name: workspaceName });
    expect(createResult.status).toBe(201);

    await new Promise((r) => setTimeout(r, 2000));
  }, 60000);

  afterAll(async () => {
    if (agent) {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {
        // Ignore cleanup errors
      }
      await agent.cleanup();
    }
    if (tempHomeDir) {
      await fs.rm(tempHomeDir, { recursive: true, force: true });
    }
  });

  it('creates .claude.json with hasCompletedOnboarding', async () => {
    const result = await agent.exec(workspaceName, 'cat /home/workspace/.claude.json');
    expect(result.code).toBe(0);

    const config = JSON.parse(result.stdout);
    expect(config.hasCompletedOnboarding).toBe(true);
  });

  it('creates .claude directory', async () => {
    const result = await agent.exec(
      workspaceName,
      'test -d /home/workspace/.claude && echo exists'
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('exists');
  });

  it('creates opencode config when zen_token is set', async () => {
    const result = await agent.exec(
      workspaceName,
      'cat /home/workspace/.config/opencode/opencode.json'
    );
    expect(result.code).toBe(0);

    const config = JSON.parse(result.stdout);
    expect(config.provider.opencode.options.apiKey).toBe('test-zen-token');
    expect(config.model).toBe('opencode/claude-sonnet-4');
  });

  it('creates .codex directory', async () => {
    const result = await agent.exec(workspaceName, 'test -d /home/workspace/.codex && echo exists');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('exists');
  });
});
