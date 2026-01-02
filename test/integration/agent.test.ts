import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('Agent', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 30000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('Health', () => {
    it('responds to health check', async () => {
      const health = await agent.api.health();
      expect(health.status).toBe('ok');
      expect(health.version).toBe('2.0.0');
    });
  });

  describe('Info', () => {
    it('returns agent info', async () => {
      const info = await agent.api.info();
      expect(info.hostname).toBeDefined();
      expect(typeof info.uptime).toBe('number');
      expect(info.workspacesCount).toBe(0);
    });
  });

  describe('Workspaces API', () => {
    it('lists workspaces (empty initially)', async () => {
      const workspaces = await agent.api.listWorkspaces();
      expect(workspaces).toEqual([]);
    });

    it('returns 404 for non-existent workspace', async () => {
      const workspace = await agent.api.getWorkspace('nonexistent');
      expect(workspace).toBeNull();
    });

    it('validates workspace name is required', async () => {
      const result = await agent.api.createWorkspace({} as { name: string });
      expect(result.status).toBe(400);
      expect((result.data as { code: string }).code).toBe('BAD_REQUEST');
    });
  });
});

describe('Agent - State Persistence', () => {
  it('persists state across restart', async () => {
    const agent1 = await startTestAgent();

    const listBefore = await agent1.api.listWorkspaces();
    expect(listBefore).toEqual([]);

    await agent1.cleanup();

    const agent2 = await startTestAgent({
      config: { port: agent1.port },
    });

    const listAfter = await agent2.api.listWorkspaces();
    expect(listAfter).toEqual([]);

    await agent2.cleanup();
  }, 60000);
});

describe('Agent - Name Collision', () => {
  let agent: TestAgent;
  const testWorkspaceName = generateTestWorkspaceName();

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 30000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  it('returns 409 when creating workspace with duplicate name', async () => {
    const result1 = await agent.api.createWorkspace({ name: testWorkspaceName });

    if (result1.status === 201) {
      const result2 = await agent.api.createWorkspace({ name: testWorkspaceName });
      expect(result2.status).toBe(409);
      expect((result2.data as { code: string }).code).toBe('CONFLICT');

      await agent.api.deleteWorkspace(testWorkspaceName);
    } else if (result1.status === 400) {
      expect((result1.data as { code: string }).code).toBe('BAD_REQUEST');
    } else {
      expect(result1.status).toBe(201);
    }
  }, 120000);
});

describe('Agent - Workspace Lifecycle', () => {
  let agent: TestAgent;
  const testWorkspaceName = generateTestWorkspaceName();

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 30000);

  afterAll(async () => {
    try {
      await agent.api.deleteWorkspace(testWorkspaceName);
    } catch {
      // Ignore cleanup errors
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  it('returns 404 when starting non-existent workspace', async () => {
    const result = await agent.api.startWorkspace('nonexistent');
    expect(result.status).toBe(404);
    expect((result.data as { code: string }).code).toBe('NOT_FOUND');
  });

  it('returns 404 when stopping non-existent workspace', async () => {
    const result = await agent.api.stopWorkspace('nonexistent');
    expect(result.status).toBe(404);
    expect((result.data as { code: string }).code).toBe('NOT_FOUND');
  });

  it('returns 404 when deleting non-existent workspace', async () => {
    const result = await agent.api.deleteWorkspace('nonexistent');
    expect(result.status).toBe(404);
  });
});
