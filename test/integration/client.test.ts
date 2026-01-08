import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { startTestAgent, type TestAgent } from '../helpers/agent';
import { ApiClient, ApiClientError, createApiClient } from '../../src/client/api';
import { loadClientConfig, saveClientConfig, getWorker, setWorker } from '../../src/client/config';

describe('API Client', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  it('can connect to agent and get health', async () => {
    const client = createApiClient(`localhost:${agent.port}`);
    const health = await client.health();

    expect(health.status).toBe('ok');
    expect(health.version).toBeDefined();
  });

  it('can get agent info', async () => {
    const client = createApiClient(`localhost:${agent.port}`);
    const info = await client.info();

    expect(info.hostname).toBeDefined();
    expect(info.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof info.workspacesCount).toBe('number');
    expect(info.dockerVersion).toBeDefined();
  });

  it('can list workspaces', async () => {
    const client = createApiClient(`localhost:${agent.port}`);
    const workspaces = await client.listWorkspaces();

    expect(Array.isArray(workspaces)).toBe(true);
  });

  it('throws error for unreachable agent', async () => {
    const client = createApiClient('localhost:59999');

    await expect(client.health()).rejects.toThrow();
  });
});

describe('API Client - Workspace Operations', () => {
  let agent: TestAgent;
  let workspaceName: string;

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  beforeEach(() => {
    workspaceName = agent.generateWorkspaceName();
  });

  afterEach(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {
      // Ignore if doesn't exist
    }
  });

  it('can create and list workspace', async () => {
    const client = createApiClient(`localhost:${agent.port}`);

    const created = await client.createWorkspace({ name: workspaceName });
    expect(created.name).toBe(workspaceName);

    const list = await client.listWorkspaces();
    const found = list.find((w) => w.name === workspaceName);
    expect(found).toBeDefined();
  }, 60000);

  it('can get workspace details', async () => {
    const client = createApiClient(`localhost:${agent.port}`);

    await client.createWorkspace({ name: workspaceName });
    const workspace = await client.getWorkspace(workspaceName);

    expect(workspace.name).toBe(workspaceName);
    expect(workspace.status).toBeDefined();
  }, 60000);

  it('can stop workspace', async () => {
    const client = createApiClient(`localhost:${agent.port}`);

    await client.createWorkspace({ name: workspaceName });
    const stopped = await client.stopWorkspace(workspaceName);

    expect(stopped.status).toBe('stopped');
  }, 60000);

  it('can delete workspace', async () => {
    const client = createApiClient(`localhost:${agent.port}`);

    await client.createWorkspace({ name: workspaceName });
    await client.deleteWorkspace(workspaceName);

    await expect(client.getWorkspace(workspaceName)).rejects.toThrow(ApiClientError);
  }, 60000);

  it('returns 404 for non-existent workspace', async () => {
    const client = createApiClient(`localhost:${agent.port}`);

    try {
      await client.getWorkspace('nonexistent-workspace-xyz');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect((err as ApiClientError).status).toBe(404);
      expect((err as ApiClientError).code).toBe('NOT_FOUND');
    }
  });
});

describe('Client Config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-client-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns null when no config exists', async () => {
    const config = await loadClientConfig(tempDir);
    expect(config).toBeNull();
  });

  it('can save and load config', async () => {
    const testConfig = { worker: 'test-worker.local' };

    await saveClientConfig(testConfig, tempDir);
    const loaded = await loadClientConfig(tempDir);

    expect(loaded).toEqual(testConfig);
  });

  it('can get and set worker', async () => {
    await setWorker('my-worker.local', tempDir);
    const worker = await getWorker(tempDir);

    expect(worker).toBe('my-worker.local');
  });

  it('getWorker returns null when not configured', async () => {
    const worker = await getWorker(tempDir);
    expect(worker).toBeNull();
  });
});

describe('createApiClient', () => {
  it('creates client with hostname and default port', () => {
    const client = createApiClient('my-worker.local');
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('creates client with hostname and custom port', () => {
    const client = createApiClient('my-worker.local', 8080);
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('creates client with full URL', () => {
    const client = createApiClient('http://my-worker.local:9000');
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('generates correct terminal URL with default port', () => {
    const client = createApiClient('my-worker.local');
    const url = client.getTerminalUrl('test-workspace');

    expect(url).toBe('ws://my-worker.local:7391/rpc/terminal/test-workspace');
  });

  it('generates correct terminal URL with explicit port', () => {
    const client = createApiClient('my-worker.local:8080');
    const url = client.getTerminalUrl('test-workspace');

    expect(url).toBe('ws://my-worker.local:8080/rpc/terminal/test-workspace');
  });
});
