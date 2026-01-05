import { parseClaudeSessionContent } from '../parser';
import type { SessionMessage } from '../types';
import type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';
import { decodeClaudeProjectPath, extractFirstUserPrompt, extractClaudeSessionName } from './utils';

export const claudeProvider: AgentSessionProvider = {
  async discoverSessions(containerName: string, exec: ExecInContainer): Promise<RawSession[]> {
    const result = await exec(
      containerName,
      [
        'bash',
        '-c',
        'find /home/workspace/.claude/projects -name "*.jsonl" -type f ! -name "agent-*.jsonl" -printf "%p\\t%T@\\t%s\\n" 2>/dev/null || true',
      ],
      { user: 'workspace' }
    );

    const sessions: RawSession[] = [];

    if (result.exitCode === 0 && result.stdout.trim()) {
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const file = parts[0];
          const mtime = Math.floor(parseFloat(parts[1]) || 0);
          const size = parseInt(parts[2], 10) || 0;
          if (size === 0) continue;

          const id = file.split('/').pop()?.replace('.jsonl', '') || '';
          const projDir = file.split('/').slice(-2, -1)[0] || '';
          const projectPath = decodeClaudeProjectPath(projDir);
          if (!projectPath.startsWith('/workspace') && !projectPath.startsWith('/home/workspace')) {
            continue;
          }

          sessions.push({
            id,
            agentType: 'claude-code',
            mtime,
            projectPath,
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

    const messages = parseClaudeSessionContent(catResult.stdout).filter(
      (msg) => msg.type !== 'system'
    );
    const firstPrompt = extractFirstUserPrompt(messages);
    const name = extractClaudeSessionName(catResult.stdout);

    if (messages.length === 0) {
      return null;
    }

    return {
      id: rawSession.id,
      name: name || null,
      agentType: rawSession.agentType,
      projectPath: rawSession.projectPath,
      messageCount: messages.length,
      lastActivity: new Date(rawSession.mtime * 1000).toISOString(),
      firstPrompt,
    };
  },

  async getSessionMessages(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer
  ): Promise<{ id: string; messages: SessionMessage[] } | null> {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    const findResult = await exec(
      containerName,
      [
        'bash',
        '-c',
        `find /home/workspace/.claude/projects -name "${safeSessionId}.jsonl" -type f 2>/dev/null | head -1`,
      ],
      { user: 'workspace' }
    );

    if (findResult.exitCode !== 0 || !findResult.stdout.trim()) {
      return null;
    }

    const filePath = findResult.stdout.trim();
    const catResult = await exec(containerName, ['cat', filePath], {
      user: 'workspace',
    });

    if (catResult.exitCode !== 0) {
      return null;
    }

    const messages = parseClaudeSessionContent(catResult.stdout)
      .filter((msg) => msg.type !== 'system')
      .filter(
        (msg) =>
          msg.type === 'tool_use' ||
          msg.type === 'tool_result' ||
          (msg.content && msg.content.trim().length > 0)
      );
    return { id: sessionId, messages };
  },
};
