import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { runCLI, runCLIExpecting, runCLIExpectingError } from '../helpers/cli-runner';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('CLI commands', () => {
  let agent: TestAgent;
  let clientConfigDir: string;

  beforeAll(async () => {
    agent = await startTestAgent();

    clientConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-cli-test-'));
    await fs.writeFile(
      path.join(clientConfigDir, 'client.json'),
      JSON.stringify({ worker: `localhost:${agent.port}` })
    );
  });

  afterAll(async () => {
    await agent.cleanup();
    await fs.rm(clientConfigDir, { recursive: true, force: true });
  });

  function cliEnv() {
    return { WS_CONFIG_DIR: clientConfigDir };
  }

  describe('workspace list', () => {
    it('lists workspaces when none exist', async () => {
      const result = await runCLI(['list'], { env: cliEnv() });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No workspaces found');
    });

    it('supports ls alias', async () => {
      const result = await runCLI(['ls'], { env: cliEnv() });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No workspaces found');
    });
  });

  describe('workspace create', () => {
    it('creates a workspace', async () => {
      const name = generateTestWorkspaceName();
      const result = await runCLIExpecting(['create', name], [`Workspace '${name}' created`], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('creates workspace with --clone option', async () => {
      const name = generateTestWorkspaceName();
      const result = await runCLI(['create', name, '--clone', 'https://github.com/example/repo'], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(`Workspace '${name}' created`);

      await agent.api.deleteWorkspace(name);
    });

    it('fails when workspace already exists', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLIExpectingError(['create', name], ['already exists'], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).not.toBe(0);

      await agent.api.deleteWorkspace(name);
    });
  });

  describe('workspace info', () => {
    it('shows agent info when no name provided', async () => {
      const result = await runCLIExpecting(['info'], ['Agent Info:', 'Hostname:', 'Docker:'], {
        env: cliEnv(),
      });
      expect(result.code).toBe(0);
    });

    it('shows workspace info when name provided', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLIExpecting(['info', name], [`Workspace: ${name}`, 'Status:'], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('fails when workspace not found', async () => {
      const result = await runCLIExpectingError(['info', 'nonexistent-workspace'], ['not found'], {
        env: cliEnv(),
      });
      expect(result.code).not.toBe(0);
    });
  });

  describe('workspace start/stop', () => {
    it('stops a running workspace', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLIExpecting(['stop', name], [`Workspace '${name}' stopped`], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('starts a stopped workspace', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });
      await agent.api.stopWorkspace(name);

      const result = await runCLIExpecting(['start', name], [`Workspace '${name}' started`], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('fails to start nonexistent workspace', async () => {
      const result = await runCLIExpectingError(['start', 'nonexistent-workspace'], ['not found'], {
        env: cliEnv(),
      });
      expect(result.code).not.toBe(0);
    });
  });

  describe('workspace delete', () => {
    it('deletes a workspace', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLIExpecting(['delete', name], [`Workspace '${name}' deleted`], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      const workspace = await agent.api.getWorkspace(name);
      expect(workspace).toBeNull();
    });

    it('supports rm alias', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLIExpecting(['rm', name], [`Workspace '${name}' deleted`], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);
    });

    it('fails to delete nonexistent workspace', async () => {
      const result = await runCLIExpectingError(
        ['delete', 'nonexistent-workspace'],
        ['not found'],
        { env: cliEnv() }
      );
      expect(result.code).not.toBe(0);
    });
  });

  describe('workspace logs', () => {
    it('shows workspace logs', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLI(['logs', name], { env: cliEnv(), timeout: 30000 });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('supports --tail option', async () => {
      const name = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name });

      const result = await runCLI(['logs', name, '--tail', '10'], {
        env: cliEnv(),
        timeout: 30000,
      });
      expect(result.code).toBe(0);

      await agent.api.deleteWorkspace(name);
    });

    it('fails for nonexistent workspace', async () => {
      const result = await runCLIExpectingError(['logs', 'nonexistent-workspace'], ['not found'], {
        env: cliEnv(),
      });
      expect(result.code).not.toBe(0);
    });
  });

  describe('config commands', () => {
    it('shows current configuration', async () => {
      const result = await runCLIExpecting(
        ['config', 'show'],
        ['Client Configuration:', 'Worker:'],
        { env: cliEnv() }
      );
      expect(result.code).toBe(0);
    });

    it('gets worker hostname', async () => {
      const result = await runCLI(['config', 'worker'], { env: cliEnv() });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(`localhost:${agent.port}`);
    });

    it('sets worker hostname', async () => {
      const result = await runCLI(['config', 'worker', 'new-host:8080'], { env: cliEnv() });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Worker set to: new-host:8080');

      await fs.writeFile(
        path.join(clientConfigDir, 'client.json'),
        JSON.stringify({ worker: `localhost:${agent.port}` })
      );
    });
  });

  describe('version and help', () => {
    it('shows version', async () => {
      const result = await runCLI(['--version']);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('shows help', async () => {
      const result = await runCLIExpecting(
        ['--help'],
        ['workspace', 'Distributed development environment', 'Commands:'],
        {}
      );
      expect(result.code).toBe(0);
    });
  });

  describe('error handling', () => {
    it('auto-detects localhost agent when no worker configured', async () => {
      const localAgent = await startTestAgent({ config: { port: 7391 } });

      const emptyConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-empty-'));
      await fs.writeFile(path.join(emptyConfigDir, 'client.json'), JSON.stringify({}));

      try {
        const result = await runCLI(['list'], {
          env: { WS_CONFIG_DIR: emptyConfigDir },
        });
        expect(result.code).toBe(0);
      } finally {
        await localAgent.cleanup();
        await fs.rm(emptyConfigDir, { recursive: true, force: true });
      }
    });

    it('shows error when agent is not reachable', async () => {
      const unreachableConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-unreach-'));
      await fs.writeFile(
        path.join(unreachableConfigDir, 'client.json'),
        JSON.stringify({ worker: 'localhost:59999' })
      );

      const result = await runCLIExpectingError(['list'], ['Unable to connect'], {
        env: { WS_CONFIG_DIR: unreachableConfigDir },
        timeout: 15000,
      });
      expect(result.code).not.toBe(0);

      await fs.rm(unreachableConfigDir, { recursive: true, force: true });
    });
  });
});
