import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/session-manager/adapters/claude', () => ({
  ClaudeCodeAdapter: class MockClaudeAdapter {
    agentType = 'claude' as const;
    private status = 'idle';
    private agentSessionId?: string;
    private messageCallback?: (msg: unknown) => void;
    private statusCallback?: (status: string) => void;
    private errorCallback?: (err: Error) => void;

    async start() {
      this.status = 'idle';
    }
    async sendMessage() {
      this.agentSessionId = 'mock-session-123';
      this.status = 'running';
      this.statusCallback?.('running');
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
    onMessage(cb: (msg: unknown) => void) {
      this.messageCallback = cb;
    }
    onStatusChange(cb: (status: string) => void) {
      this.statusCallback = cb;
    }
    onError(cb: (err: Error) => void) {
      this.errorCallback = cb;
    }
  },
}));

vi.mock('../../src/session-manager/adapters/opencode', () => ({
  OpenCodeAdapter: class MockOpenCodeAdapter {
    agentType = 'opencode' as const;
    private status = 'idle';
    private agentSessionId?: string;
    private messageCallback?: (msg: unknown) => void;
    private statusCallback?: (status: string) => void;
    private errorCallback?: (err: Error) => void;

    async start() {
      this.status = 'idle';
    }
    async sendMessage() {
      this.agentSessionId = 'mock-oc-session-123';
      this.status = 'running';
      this.statusCallback?.('running');
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
    onMessage(cb: (msg: unknown) => void) {
      this.messageCallback = cb;
    }
    onStatusChange(cb: (status: string) => void) {
      this.statusCallback = cb;
    }
    onError(cb: (err: Error) => void) {
      this.errorCallback = cb;
    }
  },
}));

vi.mock('../../src/docker', () => ({
  getContainerName: (name: string) => `workspace-${name}`,
}));

import { SessionManager } from '../../src/session-manager/manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe('startSession', () => {
    it('creates a new session with generated id', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
      });

      expect(sessionId).toMatch(/^session-/);

      const session = manager.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.workspaceName).toBe('test-workspace');
      expect(session?.agentType).toBe('claude');
      expect(session?.status).toBe('idle');
    });

    it('uses provided session id', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        sessionId: 'custom-session-id',
      });

      expect(sessionId).toBe('custom-session-id');
    });

    it('returns existing session id if already exists', async () => {
      const first = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        sessionId: 'my-session',
      });

      const second = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        sessionId: 'my-session',
      });

      expect(first).toBe(second);
    });
  });

  describe('client management', () => {
    it('connects and disconnects clients', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
      });

      const sendFn = vi.fn();
      const clientId = manager.connectClient(sessionId, sendFn);

      expect(clientId).not.toBeNull();
      expect(manager.getClientCount(sessionId)).toBe(1);

      manager.disconnectClient(sessionId, clientId!);
      expect(manager.getClientCount(sessionId)).toBe(0);
    });

    it('returns null when connecting to non-existent session', () => {
      const sendFn = vi.fn();
      const clientId = manager.connectClient('non-existent', sendFn);

      expect(clientId).toBeNull();
    });

    it('sends status message on connect', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
      });

      const sendFn = vi.fn();
      manager.connectClient(sessionId, sendFn);

      expect(sendFn).toHaveBeenCalled();
      const lastCall = sendFn.mock.calls[sendFn.mock.calls.length - 1][0];
      expect(lastCall.type).toBe('system');
      expect(lastCall.content).toContain('Connected to session');
    });
  });

  describe('session status', () => {
    it('returns null for non-existent session', () => {
      expect(manager.getSessionStatus('non-existent')).toBeNull();
    });

    it('returns session status', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
      });

      expect(manager.getSessionStatus(sessionId)).toBe('idle');
    });
  });

  describe('listActiveSessions', () => {
    it('lists all sessions', async () => {
      await manager.startSession({
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });
      await manager.startSession({
        workspaceName: 'workspace-2',
        agentType: 'claude',
      });

      const sessions = manager.listActiveSessions();
      expect(sessions).toHaveLength(2);
    });

    it('filters by workspace', async () => {
      await manager.startSession({
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });
      await manager.startSession({
        workspaceName: 'workspace-2',
        agentType: 'claude',
      });

      const sessions = manager.listActiveSessions('workspace-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].workspaceName).toBe('workspace-1');
    });
  });

  describe('disposeSession', () => {
    it('removes session', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
      });

      await manager.disposeSession(sessionId);

      expect(manager.getSession(sessionId)).toBeNull();
    });

    it('handles non-existent session gracefully', async () => {
      await expect(manager.disposeSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('disposeWorkspaceSessions', () => {
    it('disposes all sessions for a workspace', async () => {
      const session1 = await manager.startSession({
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });
      const session2 = await manager.startSession({
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });
      const session3 = await manager.startSession({
        workspaceName: 'workspace-2',
        agentType: 'claude',
      });

      await manager.disposeWorkspaceSessions('workspace-1');

      expect(manager.getSession(session1)).toBeNull();
      expect(manager.getSession(session2)).toBeNull();
      expect(manager.getSession(session3)).not.toBeNull();
    });
  });
});
