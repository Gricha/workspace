import type { SessionMessage } from '../types';
import type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';
import { extractContent } from './utils';

function parseCodexMessages(content: string): {
  sessionId: string | null;
  messages: SessionMessage[];
} {
  const lines = content.split('\n').filter(Boolean);
  let sessionId: string | null = null;
  const messages: SessionMessage[] = [];

  if (lines.length > 0) {
    try {
      const meta = JSON.parse(lines[0]) as { session_id?: string };
      if (meta.session_id) {
        sessionId = meta.session_id;
      }
    } catch {
      // ignore
    }
  }

  for (let i = 1; i < lines.length; i++) {
    try {
      const event = JSON.parse(lines[i]) as {
        payload?: {
          role?: 'user' | 'assistant';
          content?: unknown;
          message?: { role?: 'user' | 'assistant'; content?: unknown };
        };
        timestamp?: number;
      };
      const role = event.payload?.role || event.payload?.message?.role;
      const content = event.payload?.content || event.payload?.message?.content;
      if (role === 'user' || role === 'assistant') {
        const textContent = extractContent(content);
        messages.push({
          type: role,
          content: textContent || undefined,
          timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : undefined,
        });
      }
    } catch {
      continue;
    }
  }

  return { sessionId, messages };
}

export const codexProvider: AgentSessionProvider = {
  async discoverSessions(containerName: string, exec: ExecInContainer): Promise<RawSession[]> {
    const result = await exec(
      containerName,
      [
        'sh',
        '-c',
        'find /home/workspace/.codex/sessions -name "rollout-*.jsonl" -type f -printf "%p\\t%T@\\t" -exec wc -l {} \\; 2>/dev/null || true',
      ],
      { user: 'workspace' }
    );

    const sessions: RawSession[] = [];

    if (result.exitCode === 0 && result.stdout.trim()) {
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const file = parts[0];
          const mtime = Math.floor(parseFloat(parts[1]) || 0);

          const id = file.split('/').pop()?.replace('.jsonl', '') || '';
          const projPath = file
            .replace('/home/workspace/.codex/sessions/', '')
            .replace(/\/[^/]+$/, '');

          sessions.push({
            id,
            agentType: 'codex',
            projectPath: projPath,
            mtime,
            filePath: file,
          });
        }
      }
    }

    return sessions;
  },

  async getSessionDetails(
    containerName: string,
    rawSession: RawSession,
    exec: ExecInContainer
  ): Promise<SessionListItem | null> {
    const catResult = await exec(containerName, ['cat', rawSession.filePath], {
      user: 'workspace',
    });

    if (catResult.exitCode !== 0) {
      return null;
    }

    const { sessionId, messages } = parseCodexMessages(catResult.stdout);

    const firstPrompt = messages.find(
      (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
    )?.content;

    if (messages.length === 0) {
      return null;
    }

    return {
      id: sessionId || rawSession.id,
      name: null,
      agentType: rawSession.agentType,
      projectPath: rawSession.projectPath,
      messageCount: messages.length,
      lastActivity: new Date(rawSession.mtime * 1000).toISOString(),
      firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
    };
  },

  async getSessionMessages(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer,
    _projectPath?: string
  ): Promise<{ id: string; messages: SessionMessage[] } | null> {
    const findResult = await exec(
      containerName,
      ['bash', '-c', `find /home/workspace/.codex/sessions -name "*.jsonl" -type f 2>/dev/null`],
      { user: 'workspace' }
    );

    if (findResult.exitCode !== 0 || !findResult.stdout.trim()) {
      return null;
    }

    const files = findResult.stdout.trim().split('\n').filter(Boolean);

    for (const file of files) {
      const catResult = await exec(containerName, ['cat', file], {
        user: 'workspace',
      });
      if (catResult.exitCode !== 0) continue;

      const { sessionId: parsedId, messages } = parseCodexMessages(catResult.stdout);
      const fileId = file.split('/').pop()?.replace('.jsonl', '') || '';

      if (parsedId === sessionId || fileId === sessionId) {
        return { id: parsedId || fileId, messages };
      }
    }

    return null;
  },

  async deleteSession(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer
  ): Promise<{ success: boolean; error?: string }> {
    const findResult = await exec(
      containerName,
      ['bash', '-c', `find /home/workspace/.codex/sessions -name "*.jsonl" -type f 2>/dev/null`],
      { user: 'workspace' }
    );

    if (findResult.exitCode !== 0 || !findResult.stdout.trim()) {
      return { success: false, error: 'No session files found' };
    }

    const files = findResult.stdout.trim().split('\n').filter(Boolean);

    for (const file of files) {
      const fileId = file.split('/').pop()?.replace('.jsonl', '') || '';

      if (fileId === sessionId) {
        const rmResult = await exec(containerName, ['rm', '-f', file], {
          user: 'workspace',
        });
        if (rmResult.exitCode !== 0) {
          return { success: false, error: rmResult.stderr || 'Failed to delete session file' };
        }
        return { success: true };
      }

      const headResult = await exec(containerName, ['head', '-1', file], {
        user: 'workspace',
      });
      if (headResult.exitCode === 0) {
        try {
          const meta = JSON.parse(headResult.stdout) as { session_id?: string };
          if (meta.session_id === sessionId) {
            const rmResult = await exec(containerName, ['rm', '-f', file], {
              user: 'workspace',
            });
            if (rmResult.exitCode !== 0) {
              return { success: false, error: rmResult.stderr || 'Failed to delete session file' };
            }
            return { success: true };
          }
        } catch {
          continue;
        }
      }
    }

    return { success: false, error: 'Session not found' };
  },
};
