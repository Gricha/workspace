import type { SessionMessage } from '../types';
import type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';

export const opencodeProvider: AgentSessionProvider = {
  async discoverSessions(containerName: string, exec: ExecInContainer): Promise<RawSession[]> {
    const result = await exec(containerName, ['perry', 'worker', 'sessions', 'list'], {
      user: 'workspace',
    });

    if (result.exitCode !== 0) {
      return [];
    }

    try {
      const sessionData = JSON.parse(result.stdout) as Array<{
        id: string;
        title?: string;
        directory?: string;
        mtime: number;
        file: string;
      }>;

      return sessionData.map((data) => ({
        id: data.id,
        agentType: 'opencode' as const,
        projectPath: data.directory || '',
        mtime: Math.floor(data.mtime / 1000),
        name: data.title || undefined,
        filePath: data.file,
      }));
    } catch {
      return [];
    }
  },

  async getSessionDetails(
    containerName: string,
    rawSession: RawSession,
    exec: ExecInContainer
  ): Promise<SessionListItem | null> {
    const result = await exec(
      containerName,
      ['perry', 'worker', 'sessions', 'messages', rawSession.id],
      {
        user: 'workspace',
      }
    );

    if (result.exitCode !== 0) {
      return null;
    }

    try {
      const data = JSON.parse(result.stdout) as {
        id: string;
        messages: Array<{ type: string; content?: string }>;
      };

      if (data.messages.length === 0) {
        return null;
      }

      const messages = data.messages.filter(
        (m) => m.type === 'user' || m.type === 'assistant'
      ) as Array<{ type: 'user' | 'assistant'; content?: string }>;

      const firstPrompt = messages.find(
        (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
      )?.content;

      return {
        id: rawSession.id,
        name: rawSession.name || null,
        agentType: rawSession.agentType,
        projectPath: rawSession.projectPath,
        messageCount: messages.length,
        lastActivity: new Date(rawSession.mtime * 1000).toISOString(),
        firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
      };
    } catch {
      return null;
    }
  },

  async getSessionMessages(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer,
    _projectPath?: string
  ): Promise<{ id: string; messages: SessionMessage[] } | null> {
    const result = await exec(
      containerName,
      ['perry', 'worker', 'sessions', 'messages', sessionId],
      {
        user: 'workspace',
      }
    );

    if (result.exitCode !== 0) {
      return null;
    }

    try {
      const data = JSON.parse(result.stdout) as {
        id: string;
        messages: Array<{
          type: string;
          content?: string;
          toolName?: string;
          toolId?: string;
          toolInput?: string;
          timestamp?: string;
        }>;
      };

      return {
        id: sessionId,
        messages: data.messages as SessionMessage[],
      };
    } catch {
      return null;
    }
  },

  async deleteSession(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer
  ): Promise<{ success: boolean; error?: string }> {
    const result = await exec(containerName, ['perry', 'worker', 'sessions', 'delete', sessionId], {
      user: 'workspace',
    });

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || 'Failed to delete session' };
    }

    try {
      return JSON.parse(result.stdout) as { success: boolean; error?: string };
    } catch {
      return { success: false, error: 'Invalid response from worker' };
    }
  },
};
