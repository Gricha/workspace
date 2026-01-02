import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';
import * as docker from '../../src/docker';

describe('E2E - Workspace Creation', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let containerName: string;

  beforeAll(async () => {
    agent = await startTestAgent();
    workspaceName = generateTestWorkspaceName();
    containerName = `workspace-${workspaceName}`;
  }, 60000);

  afterAll(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {
      // Ignore cleanup errors
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  it('creates a workspace with running container', async () => {
    const result = await agent.api.createWorkspace({ name: workspaceName });

    expect(result.status).toBe(201);
    expect(result.data.name).toBe(workspaceName);
    expect(result.data.status).toBe('running');

    const running = await docker.containerRunning(containerName);
    expect(running).toBe(true);
  }, 120000);

  it('container has required CLI tools', async () => {
    const tools = [
      { cmd: 'rg --version', check: 'ripgrep', name: 'ripgrep' },
      { cmd: 'fdfind --version', check: 'fdfind', name: 'fd-find' },
      { cmd: 'git --version', check: 'git version', name: 'Git' },
      { cmd: 'node --version', check: 'v', name: 'Node.js' },
      { cmd: 'npm --version', check: /^\d+\.\d+\.\d+/, name: 'npm' },
      { cmd: 'python3 --version', check: 'Python', name: 'Python 3' },
      { cmd: 'gh --version', check: 'gh version', name: 'GitHub CLI' },
      { cmd: 'nvim --version', check: 'NVIM', name: 'Neovim' },
    ];

    for (const tool of tools) {
      const result = await docker.execInContainer(containerName, ['bash', '-c', tool.cmd], {
        user: 'workspace',
      });

      const output = result.stdout + result.stderr;
      if (typeof tool.check === 'string') {
        expect(output).toContain(tool.check);
      } else {
        expect(output).toMatch(tool.check);
      }
    }
  }, 60000);

  it('container has Docker-in-Docker working', async () => {
    let result;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      result = await docker.execInContainer(containerName, ['docker', 'info'], {
        user: 'workspace',
      });

      if (result.exitCode === 0 && result.stdout.includes('Server Version')) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    expect(result!.exitCode).toBe(0);
    expect(result!.stdout).toContain('Server Version');
  }, 60000);

  it('workspace user has correct permissions', async () => {
    const whoamiResult = await docker.execInContainer(containerName, ['whoami'], {
      user: 'workspace',
    });
    expect(whoamiResult.stdout.trim()).toBe('workspace');

    const groupsResult = await docker.execInContainer(containerName, ['groups'], {
      user: 'workspace',
    });
    expect(groupsResult.stdout).toContain('sudo');
    expect(groupsResult.stdout).toContain('docker');

    const sudoResult = await docker.execInContainer(
      containerName,
      ['sudo', '-n', 'echo', 'sudo-works'],
      { user: 'workspace' }
    );
    expect(sudoResult.stdout.trim()).toBe('sudo-works');
  }, 30000);

  it('home directory has correct structure', async () => {
    const lsResult = await docker.execInContainer(containerName, ['ls', '-la', '/home/workspace'], {
      user: 'workspace',
    });

    expect(lsResult.stdout).toContain('.local');
  }, 30000);

  it('can stop and restart workspace', async () => {
    const stopResult = await agent.api.stopWorkspace(workspaceName);
    expect(stopResult.status).toBe(200);
    expect(stopResult.data.status).toBe('stopped');

    const runningStopped = await docker.containerRunning(containerName);
    expect(runningStopped).toBe(false);

    const startResult = await agent.api.startWorkspace(workspaceName);
    expect(startResult.status).toBe(200);
    expect(startResult.data.status).toBe('running');

    const runningStarted = await docker.containerRunning(containerName);
    expect(runningStarted).toBe(true);
  }, 60000);

  it('can execute commands via terminal WebSocket', async () => {
    const WebSocket = (await import('ws')).default;

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 10000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', reject);
    });

    let output = '';
    ws.on('message', (data: Buffer) => {
      output += data.toString();
    });

    ws.send('echo "E2E_TEST_OUTPUT"\n');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(output).toContain('E2E_TEST_OUTPUT');

    ws.close();
  }, 30000);

  it('persists data across restart', async () => {
    await docker.execInContainer(
      containerName,
      ['bash', '-c', 'echo "persistent-data" > /home/workspace/test-file.txt'],
      { user: 'workspace' }
    );

    await agent.api.stopWorkspace(workspaceName);
    await agent.api.startWorkspace(workspaceName);

    const result = await docker.execInContainer(
      containerName,
      ['cat', '/home/workspace/test-file.txt'],
      { user: 'workspace' }
    );

    expect(result.stdout.trim()).toBe('persistent-data');
  }, 60000);

  it('deletes workspace and cleans up resources', async () => {
    const deleteResult = await agent.api.deleteWorkspace(workspaceName);
    expect(deleteResult.status).toBe(200);

    const containerExists = await docker.containerExists(containerName);
    expect(containerExists).toBe(false);

    const volumeExists = await docker.volumeExists(`workspace-${workspaceName}`);
    expect(volumeExists).toBe(false);

    const getResult = await agent.api.getWorkspace(workspaceName);
    expect(getResult).toBeNull();
  }, 60000);
});
