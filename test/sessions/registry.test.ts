import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSession,
  linkAgentSession,
  touchSession,
  getSession,
  findSessionByAgentId,
  getSessionsForWorkspace,
  getAllSessions,
  deleteSession,
  importExternalSession,
  sessionExists,
  type SessionRecord,
} from '../../src/sessions/registry';

describe('Session Registry', () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), 'perry-registry-test-'));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('creates a session with generated timestamps', async () => {
      const before = new Date().toISOString();

      const session = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const after = new Date().toISOString();

      expect(session.perrySessionId).toBe('perry-123');
      expect(session.workspaceName).toBe('my-workspace');
      expect(session.agentType).toBe('claude');
      expect(session.agentSessionId).toBeNull();
      expect(session.projectPath).toBeNull();
      expect(session.createdAt >= before).toBe(true);
      expect(session.createdAt <= after).toBe(true);
      expect(session.lastActivity).toBe(session.createdAt);
    });

    it('creates a session with optional fields', async () => {
      const session = await createSession(stateDir, {
        perrySessionId: 'perry-456',
        workspaceName: 'my-workspace',
        agentType: 'opencode',
        agentSessionId: 'agent-789',
        projectPath: '/home/workspace/project',
      });

      expect(session.agentSessionId).toBe('agent-789');
      expect(session.projectPath).toBe('/home/workspace/project');
    });

    it('persists session to disk', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const content = await readFile(join(stateDir, 'session-registry.json'), 'utf-8');
      const registry = JSON.parse(content);

      expect(registry.version).toBe(1);
      expect(registry.sessions['perry-123']).toBeDefined();
      expect(registry.sessions['perry-123'].workspaceName).toBe('my-workspace');
    });

    it('overwrites existing session with same ID', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });

      const updated = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'workspace-2',
        agentType: 'opencode',
      });

      expect(updated.workspaceName).toBe('workspace-2');
      expect(updated.agentType).toBe('opencode');

      const retrieved = await getSession(stateDir, 'perry-123');
      expect(retrieved?.workspaceName).toBe('workspace-2');
    });
  });

  describe('linkAgentSession', () => {
    it('links agent session ID to existing Perry session', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const linked = await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      expect(linked).not.toBeNull();
      expect(linked!.agentSessionId).toBe('claude-session-abc');
    });

    it('updates lastActivity when linking', async () => {
      const created = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const linked = await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      expect(linked!.lastActivity > created.lastActivity).toBe(true);
    });

    it('returns null for non-existent session', async () => {
      const result = await linkAgentSession(stateDir, 'non-existent', 'agent-123');
      expect(result).toBeNull();
    });

    it('persists the link to disk', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      // Simulate server restart by reading fresh from disk
      const retrieved = await getSession(stateDir, 'perry-123');
      expect(retrieved?.agentSessionId).toBe('claude-session-abc');
    });
  });

  describe('touchSession', () => {
    it('updates lastActivity timestamp', async () => {
      const created = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const touched = await touchSession(stateDir, 'perry-123');

      expect(touched!.lastActivity > created.lastActivity).toBe(true);
      expect(touched!.createdAt).toBe(created.createdAt);
    });

    it('returns null for non-existent session', async () => {
      const result = await touchSession(stateDir, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getSession', () => {
    it('retrieves existing session', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        projectPath: '/some/path',
      });

      const session = await getSession(stateDir, 'perry-123');

      expect(session).not.toBeNull();
      expect(session!.perrySessionId).toBe('perry-123');
      expect(session!.projectPath).toBe('/some/path');
    });

    it('returns null for non-existent session', async () => {
      const session = await getSession(stateDir, 'non-existent');
      expect(session).toBeNull();
    });
  });

  describe('findSessionByAgentId', () => {
    it('finds session by agent type and agent session ID', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });

      const found = await findSessionByAgentId(stateDir, 'claude', 'claude-abc');

      expect(found).not.toBeNull();
      expect(found!.perrySessionId).toBe('perry-123');
    });

    it('returns null when agent ID not found', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });

      const found = await findSessionByAgentId(stateDir, 'claude', 'different-id');
      expect(found).toBeNull();
    });

    it('returns null when agent type does not match', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'session-abc',
      });

      const found = await findSessionByAgentId(stateDir, 'opencode', 'session-abc');
      expect(found).toBeNull();
    });

    it('does not find sessions without agent ID linked', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        // No agentSessionId
      });

      const found = await findSessionByAgentId(stateDir, 'claude', 'any-id');
      expect(found).toBeNull();
    });
  });

  describe('getSessionsForWorkspace', () => {
    it('returns sessions for specific workspace', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });
      await createSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'workspace-a',
        agentType: 'opencode',
      });
      await createSession(stateDir, {
        perrySessionId: 'perry-3',
        workspaceName: 'workspace-b',
        agentType: 'claude',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'workspace-a');

      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.workspaceName === 'workspace-a')).toBe(true);
    });

    it('returns empty array for workspace with no sessions', async () => {
      const sessions = await getSessionsForWorkspace(stateDir, 'empty-workspace');
      expect(sessions).toEqual([]);
    });

    it('returns sessions sorted by lastActivity descending', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await touchSession(stateDir, 'perry-1'); // Make perry-1 most recent

      const sessions = await getSessionsForWorkspace(stateDir, 'workspace-a');

      expect(sessions[0].perrySessionId).toBe('perry-1');
      expect(sessions[1].perrySessionId).toBe('perry-2');
    });
  });

  describe('getAllSessions', () => {
    it('returns all sessions across workspaces', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });
      await createSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'workspace-b',
        agentType: 'opencode',
      });

      const sessions = await getAllSessions(stateDir);

      expect(sessions).toHaveLength(2);
    });

    it('returns empty array when no sessions exist', async () => {
      const sessions = await getAllSessions(stateDir);
      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('deletes existing session', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const result = await deleteSession(stateDir, 'perry-123');

      expect(result).toBe(true);

      const session = await getSession(stateDir, 'perry-123');
      expect(session).toBeNull();
    });

    it('returns false for non-existent session', async () => {
      const result = await deleteSession(stateDir, 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('importExternalSession', () => {
    it('imports external session with all fields', async () => {
      const session = await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external-abc',
        projectPath: '/home/workspace/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-02T00:00:00.000Z',
      });

      expect(session.perrySessionId).toBe('perry-ext-123');
      expect(session.agentSessionId).toBe('claude-external-abc');
      expect(session.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(session.lastActivity).toBe('2024-01-02T00:00:00.000Z');
    });

    it('returns existing session if agent ID already imported', async () => {
      const first = await importExternalSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });

      const second = await importExternalSession(stateDir, {
        perrySessionId: 'perry-2', // Different Perry ID
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc', // Same agent ID
      });

      expect(second.perrySessionId).toBe('perry-1'); // Returns first, not second
    });

    it('generates timestamps if not provided', async () => {
      const before = new Date().toISOString();

      const session = await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-123',
        workspaceName: 'my-workspace',
        agentType: 'opencode',
        agentSessionId: 'oc-external',
      });

      const after = new Date().toISOString();

      expect(session.createdAt >= before).toBe(true);
      expect(session.createdAt <= after).toBe(true);
    });
  });

  describe('sessionExists', () => {
    beforeEach(async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });
    });

    it('returns true for existing Perry session ID', async () => {
      const exists = await sessionExists(stateDir, { perrySessionId: 'perry-123' });
      expect(exists).toBe(true);
    });

    it('returns false for non-existent Perry session ID', async () => {
      const exists = await sessionExists(stateDir, { perrySessionId: 'non-existent' });
      expect(exists).toBe(false);
    });

    it('returns true for existing agent session ID', async () => {
      const exists = await sessionExists(stateDir, {
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });
      expect(exists).toBe(true);
    });

    it('returns false for non-existent agent session ID', async () => {
      const exists = await sessionExists(stateDir, {
        agentType: 'claude',
        agentSessionId: 'non-existent',
      });
      expect(exists).toBe(false);
    });

    it('returns false when no options provided', async () => {
      const exists = await sessionExists(stateDir, {});
      expect(exists).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty registry file gracefully', async () => {
      // Registry doesn't exist yet
      const sessions = await getAllSessions(stateDir);
      expect(sessions).toEqual([]);
    });

    it('handles concurrent session creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        createSession(stateDir, {
          perrySessionId: `perry-${i}`,
          workspaceName: 'my-workspace',
          agentType: 'claude',
        })
      );

      await Promise.all(promises);

      const sessions = await getAllSessions(stateDir);
      expect(sessions).toHaveLength(10);
    });

    it('survives server restart (data persisted)', async () => {
      // Create session
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      // Link agent session
      await linkAgentSession(stateDir, 'perry-123', 'claude-abc');

      // "Restart" - clear any in-memory state by just using the functions again
      // (they always read from disk)
      const session = await getSession(stateDir, 'perry-123');

      expect(session).not.toBeNull();
      expect(session!.agentSessionId).toBe('claude-abc');
    });

    it('agent responds after client disconnects - link still persists', async () => {
      // Simulate: client creates session, disconnects
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      // Client is gone, but server receives agent response and links it
      await linkAgentSession(stateDir, 'perry-123', 'claude-abc');

      // Later, client reconnects and can find the session
      const session = await getSession(stateDir, 'perry-123');
      expect(session?.agentSessionId).toBe('claude-abc');

      // Or find by agent ID
      const found = await findSessionByAgentId(stateDir, 'claude', 'claude-abc');
      expect(found?.perrySessionId).toBe('perry-123');
    });

    it('merging external sessions does not duplicate', async () => {
      // First, import an external session
      await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-1',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      // Try to import again with different Perry ID
      await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-2',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'my-workspace');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].perrySessionId).toBe('perry-ext-1');
    });
  });

  describe('connectivity and reconnection scenarios', () => {
    it('session exists before agent responds (pending link)', async () => {
      // Client sends first message, session created with no agentSessionId
      const session = await createSession(stateDir, {
        perrySessionId: 'perry-pending',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        // No agentSessionId yet - agent hasn't responded
      });

      expect(session.agentSessionId).toBeNull();

      // Session should be findable by perrySessionId
      const found = await getSession(stateDir, 'perry-pending');
      expect(found).not.toBeNull();
      expect(found!.perrySessionId).toBe('perry-pending');

      // But NOT findable by agentSessionId (none linked yet)
      const notFound = await findSessionByAgentId(stateDir, 'claude', 'any-id');
      expect(notFound).toBeNull();
    });

    it('client disconnects before agent responds, reconnects after', async () => {
      // Step 1: Client creates session, then disconnects
      await createSession(stateDir, {
        perrySessionId: 'perry-disconnect',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      // Step 2: Agent responds while client is disconnected - link is created
      await linkAgentSession(stateDir, 'perry-disconnect', 'claude-abc-123');

      // Step 3: Client reconnects - should find session by either ID
      const byPerryId = await getSession(stateDir, 'perry-disconnect');
      expect(byPerryId).not.toBeNull();
      expect(byPerryId!.agentSessionId).toBe('claude-abc-123');

      const byAgentId = await findSessionByAgentId(stateDir, 'claude', 'claude-abc-123');
      expect(byAgentId).not.toBeNull();
      expect(byAgentId!.perrySessionId).toBe('perry-disconnect');
    });

    it('multiple link attempts are idempotent', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-multi',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      // Multiple link attempts with same agentSessionId
      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');
      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');
      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');

      const session = await getSession(stateDir, 'perry-multi');
      expect(session!.agentSessionId).toBe('claude-xyz');
    });

    it('link updates if agent provides new session ID', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-update',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-update', 'claude-first');
      const first = await getSession(stateDir, 'perry-update');
      expect(first!.agentSessionId).toBe('claude-first');

      // Agent provides different session ID (e.g., session resumed differently)
      await linkAgentSession(stateDir, 'perry-update', 'claude-second');
      const second = await getSession(stateDir, 'perry-update');
      expect(second!.agentSessionId).toBe('claude-second');
    });

    it('reconnect to session started outside Perry (via import)', async () => {
      // User started a Claude session in terminal, now wants to continue in Perry
      const imported = await importExternalSession(stateDir, {
        perrySessionId: 'perry-imported',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-terminal-session',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      });

      expect(imported.perrySessionId).toBe('perry-imported');
      expect(imported.agentSessionId).toBe('claude-terminal-session');

      // Should be findable by agentSessionId
      const found = await findSessionByAgentId(stateDir, 'claude', 'claude-terminal-session');
      expect(found).not.toBeNull();
      expect(found!.perrySessionId).toBe('perry-imported');
    });

    it('session listing includes both Perry-started and imported sessions', async () => {
      // Perry-started session
      await createSession(stateDir, {
        perrySessionId: 'perry-native',
        workspaceName: 'test-ws',
        agentType: 'claude',
      });
      await linkAgentSession(stateDir, 'perry-native', 'claude-native');

      // Imported external session
      await importExternalSession(stateDir, {
        perrySessionId: 'perry-external',
        workspaceName: 'test-ws',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'test-ws');
      expect(sessions).toHaveLength(2);

      const perryIds = sessions.map((s) => s.perrySessionId);
      expect(perryIds).toContain('perry-native');
      expect(perryIds).toContain('perry-external');
    });

    it('activity tracking persists across reconnections', async () => {
      const created = await createSession(stateDir, {
        perrySessionId: 'perry-activity',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate activity from agent (touch updates lastActivity)
      await touchSession(stateDir, 'perry-activity');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Link agent session (also updates lastActivity)
      await linkAgentSession(stateDir, 'perry-activity', 'claude-active');

      const final = await getSession(stateDir, 'perry-activity');
      expect(final!.lastActivity > created.lastActivity).toBe(true);
      expect(final!.createdAt).toBe(created.createdAt); // Created time unchanged
    });

    it('sessions sorted by most recent activity for reconnection UX', async () => {
      // Create sessions with staggered activity
      await createSession(stateDir, {
        perrySessionId: 'perry-old',
        workspaceName: 'ux-test',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 15));

      await createSession(stateDir, {
        perrySessionId: 'perry-newer',
        workspaceName: 'ux-test',
        agentType: 'opencode',
      });

      await new Promise((resolve) => setTimeout(resolve, 15));

      // Touch the old session to make it most recent
      await touchSession(stateDir, 'perry-old');

      const sessions = await getSessionsForWorkspace(stateDir, 'ux-test');

      // Most recently active should be first
      expect(sessions[0].perrySessionId).toBe('perry-old');
      expect(sessions[1].perrySessionId).toBe('perry-newer');
    });

    it('different agent types tracked separately', async () => {
      // Same agentSessionId but different agent types (unlikely but possible)
      await createSession(stateDir, {
        perrySessionId: 'perry-claude',
        workspaceName: 'multi-agent',
        agentType: 'claude',
        agentSessionId: 'session-123',
      });

      await createSession(stateDir, {
        perrySessionId: 'perry-opencode',
        workspaceName: 'multi-agent',
        agentType: 'opencode',
        agentSessionId: 'session-123', // Same ID, different agent
      });

      const claude = await findSessionByAgentId(stateDir, 'claude', 'session-123');
      const opencode = await findSessionByAgentId(stateDir, 'opencode', 'session-123');

      expect(claude!.perrySessionId).toBe('perry-claude');
      expect(opencode!.perrySessionId).toBe('perry-opencode');
    });

    it('handles rapid session creation during reconnection attempts', async () => {
      // Simulate rapid reconnection attempts creating sessions
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          createSession(stateDir, {
            perrySessionId: `perry-rapid-${i}`,
            workspaceName: 'rapid-test',
            agentType: 'claude',
          })
        );
      }

      await Promise.all(promises);

      const sessions = await getSessionsForWorkspace(stateDir, 'rapid-test');
      expect(sessions).toHaveLength(5);
    });

    it('preserves session data through full lifecycle', async () => {
      // Full lifecycle: create -> link -> activity -> persist -> recover

      // 1. Create (first message sent)
      await createSession(stateDir, {
        perrySessionId: 'perry-lifecycle',
        workspaceName: 'lifecycle-ws',
        agentType: 'claude',
        projectPath: '/home/user/project',
      });

      // 2. Link (agent responds)
      await linkAgentSession(stateDir, 'perry-lifecycle', 'claude-lifecycle-id');

      // 3. Activity (conversation continues)
      await touchSession(stateDir, 'perry-lifecycle');

      // 4. "Server restart" - read fresh from disk
      const recovered = await getSession(stateDir, 'perry-lifecycle');

      expect(recovered).not.toBeNull();
      expect(recovered!.perrySessionId).toBe('perry-lifecycle');
      expect(recovered!.workspaceName).toBe('lifecycle-ws');
      expect(recovered!.agentType).toBe('claude');
      expect(recovered!.agentSessionId).toBe('claude-lifecycle-id');
      expect(recovered!.projectPath).toBe('/home/user/project');
    });

    it('deleted session cannot be reconnected to', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-deleted',
        workspaceName: 'delete-test',
        agentType: 'claude',
        agentSessionId: 'claude-to-delete',
      });

      // Verify exists
      expect(await getSession(stateDir, 'perry-deleted')).not.toBeNull();

      // Delete
      await deleteSession(stateDir, 'perry-deleted');

      // Cannot reconnect by either ID
      expect(await getSession(stateDir, 'perry-deleted')).toBeNull();
      expect(await findSessionByAgentId(stateDir, 'claude', 'claude-to-delete')).toBeNull();
    });

    it('workspace isolation - sessions from different workspaces', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-ws1',
        workspaceName: 'workspace-1',
        agentType: 'claude',
        agentSessionId: 'claude-ws1',
      });

      await createSession(stateDir, {
        perrySessionId: 'perry-ws2',
        workspaceName: 'workspace-2',
        agentType: 'claude',
        agentSessionId: 'claude-ws2',
      });

      const ws1Sessions = await getSessionsForWorkspace(stateDir, 'workspace-1');
      const ws2Sessions = await getSessionsForWorkspace(stateDir, 'workspace-2');

      expect(ws1Sessions).toHaveLength(1);
      expect(ws2Sessions).toHaveLength(1);
      expect(ws1Sessions[0].perrySessionId).toBe('perry-ws1');
      expect(ws2Sessions[0].perrySessionId).toBe('perry-ws2');
    });
  });
});
