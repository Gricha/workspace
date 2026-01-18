import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('Agent Sync Integration', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let tempHomeDir: string;
  let originalHome: string | undefined;
  let opencodeToken: string;

  beforeAll(async () => {
    tempHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-sync-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempHomeDir;
    opencodeToken = process.env.OPENCODE_TOKEN || 'test-opencode-token';

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

    await fs.mkdir(path.join(tempHomeDir, '.local', 'share', 'opencode'), { recursive: true });
    await fs.writeFile(
      path.join(tempHomeDir, '.local', 'share', 'opencode', 'auth.json'),
      JSON.stringify({
        opencode: {
          type: 'api',
          key: opencodeToken,
        },
      })
    );

    agent = await startTestAgent();

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
    process.env.HOME = originalHome;
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

  it('copies host opencode config into workspace', async () => {
    const result = await agent.exec(
      workspaceName,
      'cat /home/workspace/.config/opencode/opencode.json'
    );
    expect(result.code).toBe(0);

    const config = JSON.parse(result.stdout);
    expect(config.mcp).toEqual({
      'opencode-mcp': { type: 'local', command: ['bun', 'run', 'server'] },
    });
  });

  it('copies host opencode auth into workspace', async () => {
    const result = await agent.exec(
      workspaceName,
      'cat /home/workspace/.local/share/opencode/auth.json'
    );
    expect(result.code).toBe(0);

    const config = JSON.parse(result.stdout);
    expect(config).toEqual({
      opencode: {
        type: 'api',
        key: opencodeToken,
      },
    });
  });

  it('creates .codex directory', async () => {
    const result = await agent.exec(workspaceName, 'test -d /home/workspace/.codex && echo exists');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('exists');
  });
});
