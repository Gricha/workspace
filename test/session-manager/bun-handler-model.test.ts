import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SessionStatus } from '../../src/session-manager/types';

vi.mock('../../src/session-manager/adapters/claude', () => ({
  ClaudeCodeAdapter: class MockClaudeAdapter {
    agentType = 'claude' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model = 'sonnet';

    async start(options: { model?: string; agentSessionId?: string }) {
      if (options.model) this.model = options.model;
      if (options.agentSessionId) this.agentSessionId = options.agentSessionId;
    }

    async sendMessage() {
      this.status = 'running';
      setTimeout(() => {
        this.status = 'idle';
      }, 0);
    }

    setModel(model: string) {
      this.model = model;
    }

    async interrupt() {
      this.status = 'interrupted';
    }

    async dispose() {}

    getAgentSessionId() {
      return this.agentSessionId;
    }

    getStatus() {
      return this.status;
    }

    onMessage() {}
    onStatusChange() {}
    onError() {}
  },
}));

vi.mock('../../src/session-manager/adapters/opencode', () => ({
  OpenCodeAdapter: class MockOpenCodeAdapter {
    agentType = 'opencode' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model?: string;

    async start(options: { model?: string; agentSessionId?: string }) {
      if (options.model) this.model = options.model;
      if (options.agentSessionId) this.agentSessionId = options.agentSessionId;
    }

    async sendMessage() {
      this.status = 'running';
      setTimeout(() => {
        this.status = 'idle';
      }, 0);
    }

    setModel(model: string) {
      this.model = model;
    }

    async interrupt() {
      this.status = 'interrupted';
    }

    async dispose() {}

    getAgentSessionId() {
      return this.agentSessionId;
    }

    getStatus() {
      return this.status;
    }

    onMessage() {}
    onStatusChange() {}
    onError() {}
  },
}));

vi.mock('../../src/docker', () => ({
  getContainerName: (name: string) => `workspace-${name}`,
}));

vi.mock('../../src/session-manager/manager', async () => {
  const actual = await vi.importActual<typeof import('../../src/session-manager/manager')>(
    '../../src/session-manager/manager'
  );

  const manager = new actual.SessionManager();
  return { ...actual, sessionManager: manager };
});

import { sessionManager } from '../../src/session-manager/manager';
import { LiveChatHandler } from '../../src/session-manager/bun-handler';

function createWs(sent: unknown[]) {
  return {
    send(data: string) {
      sent.push(JSON.parse(data));
    },
    close: vi.fn(),
  } as any;
}

describe('bun-handler model selection handling', () => {
  const workspaceName = 'test-workspace';

  beforeEach(() => {
    // No-op
  });

  afterEach(async () => {
    await sessionManager.disposeAll();
  });

  it('updates model when rejoining with different model', async () => {
    const sent: any[] = [];
    const ws = createWs(sent);

    const handler = new LiveChatHandler({
      agentType: 'claude',
      isWorkspaceRunning: async () => true,
    });

    handler.handleOpen(ws, workspaceName);

    await handler.handleMessage(
      ws,
      JSON.stringify({
        type: 'connect',
        workspaceName,
        agentType: 'claude',
        sessionId: 'my-session',
        model: 'sonnet',
      })
    );

    const firstSessionStarted = sent.find((m) => m.type === 'session_started');
    expect(firstSessionStarted).toBeTruthy();

    await handler.handleMessage(
      ws,
      JSON.stringify({
        type: 'connect',
        workspaceName,
        agentType: 'claude',
        sessionId: 'my-session',
        model: 'opus',
      })
    );

    const joined = [...sent].reverse().find((m) => m.type === 'session_joined');
    expect(joined).toBeTruthy();
    expect(joined.model).toBe('opus');

    const found = await sessionManager.findSession('my-session');
    expect(found?.info.model).toBe('opus');
  });
});
