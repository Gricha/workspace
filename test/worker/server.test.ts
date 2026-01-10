import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestAgent, execInWorkspace, type TestAgent } from '../helpers/agent';
import { getContainerIp } from '../../src/docker';

const WORKER_PORT = 7392;

describe('Worker Server Integration', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let containerName: string;
  let workerUrl: string;

  beforeAll(async () => {
    agent = await startTestAgent();
    workspaceName = agent.generateWorkspaceName();
    containerName = `workspace-${workspaceName}`;

    await agent.api.createWorkspace({ name: workspaceName });
    await agent.api.startWorkspace(workspaceName);

    await execInWorkspace(
      containerName,
      'mkdir -p ~/.claude/projects/test-project && echo \'{"type":"user","message":{"content":[{"type":"text","text":"Hello from test"}]}}\' > ~/.claude/projects/test-project/test-session.jsonl'
    );

    await execInWorkspace(containerName, 'perry worker serve &');
    await new Promise((r) => setTimeout(r, 1000));

    const ip = await getContainerIp(containerName);
    workerUrl = `http://${ip}:${WORKER_PORT}`;
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  it('responds to health check', async () => {
    const response = await fetch(`${workerUrl}/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(typeof data.sessionCount).toBe('number');
  });

  it('lists sessions', async () => {
    const response = await fetch(`${workerUrl}/sessions`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('gets single session', async () => {
    const listResponse = await fetch(`${workerUrl}/sessions`);
    const listData = await listResponse.json();

    if (listData.sessions.length > 0) {
      const sessionId = listData.sessions[0].id;
      const response = await fetch(`${workerUrl}/sessions/${sessionId}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.session).toBeDefined();
      expect(data.session.id).toBe(sessionId);
    }
  });

  it('returns 404 for unknown session', async () => {
    const response = await fetch(`${workerUrl}/sessions/nonexistent-session-id`);
    expect(response.status).toBe(404);
  });

  it('gets session messages with pagination', async () => {
    const listResponse = await fetch(`${workerUrl}/sessions`);
    const listData = await listResponse.json();

    if (listData.sessions.length > 0) {
      const sessionId = listData.sessions[0].id;
      const response = await fetch(`${workerUrl}/sessions/${sessionId}/messages?limit=10&offset=0`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.id).toBe(sessionId);
      expect(Array.isArray(data.messages)).toBe(true);
      expect(typeof data.total).toBe('number');
    }
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${workerUrl}/unknown-route`);
    expect(response.status).toBe(404);
  });
});
