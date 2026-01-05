import type { SessionMessage } from '../types';
import type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';
import { extractContent } from './utils';

export const opencodeProvider: AgentSessionProvider = {
  async discoverSessions(containerName: string, exec: ExecInContainer): Promise<RawSession[]> {
    const result = await exec(
      containerName,
      [
        'sh',
        '-c',
        'find /home/workspace/.local/share/opencode/storage/session -name "ses_*.json" -type f 2>/dev/null || true',
      ],
      { user: 'workspace' }
    );

    const sessions: RawSession[] = [];

    if (result.exitCode === 0 && result.stdout.trim()) {
      const files = result.stdout.trim().split('\n').filter(Boolean);
      const catAll = await exec(
        containerName,
        ['sh', '-c', `cat ${files.map((f) => `"${f}"`).join(' ')} 2>/dev/null | jq -s '.'`],
        { user: 'workspace' }
      );

      if (catAll.exitCode === 0) {
        try {
          const sessionData = JSON.parse(catAll.stdout) as Array<{
            id?: string;
            title?: string;
            directory?: string;
            time?: { updated?: number };
          }>;

          for (let i = 0; i < sessionData.length; i++) {
            const data = sessionData[i];
            const file = files[i];
            const id = data.id || file.split('/').pop()?.replace('.json', '') || '';
            const mtime = Math.floor((data.time?.updated || 0) / 1000);

            sessions.push({
              id,
              agentType: 'opencode',
              projectPath: data.directory || '',
              mtime,
              name: data.title || undefined,
              filePath: file,
            });
          }
        } catch {
          // Skip on parse error
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
    const msgDir = `/home/workspace/.local/share/opencode/storage/message/${rawSession.id}`;
    const listMsgsResult = await exec(
      containerName,
      ['bash', '-c', `ls -1 "${msgDir}"/msg_*.json 2>/dev/null | sort`],
      { user: 'workspace' }
    );

    const messages: Array<{ type: 'user' | 'assistant'; content?: string }> = [];

    if (listMsgsResult.exitCode === 0 && listMsgsResult.stdout.trim()) {
      const msgFiles = listMsgsResult.stdout.trim().split('\n').filter(Boolean);
      for (const msgFile of msgFiles) {
        const msgResult = await exec(containerName, ['cat', msgFile], {
          user: 'workspace',
        });
        if (msgResult.exitCode !== 0) continue;
        try {
          const msg = JSON.parse(msgResult.stdout) as {
            role?: 'user' | 'assistant';
            content?: unknown;
          };
          if (msg.role === 'user' || msg.role === 'assistant') {
            const content = extractContent(msg.content);
            messages.push({ type: msg.role, content: content || undefined });
          }
        } catch {
          continue;
        }
      }
    }

    const firstPrompt = messages.find(
      (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
    )?.content;

    if (messages.length === 0) {
      return null;
    }

    return {
      id: rawSession.id,
      name: rawSession.name || null,
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
    exec: ExecInContainer
  ): Promise<{ id: string; messages: SessionMessage[] } | null> {
    const findResult = await exec(
      containerName,
      [
        'bash',
        '-c',
        `find /home/workspace/.local/share/opencode/storage/session -name "${sessionId}.json" -type f 2>/dev/null | head -1`,
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

    let internalId: string;
    try {
      const session = JSON.parse(catResult.stdout) as { id: string };
      internalId = session.id;
    } catch {
      return null;
    }

    const msgDir = `/home/workspace/.local/share/opencode/storage/message/${internalId}`;
    const partDir = `/home/workspace/.local/share/opencode/storage/part`;
    const listMsgsResult = await exec(
      containerName,
      ['bash', '-c', `ls -1 "${msgDir}"/msg_*.json 2>/dev/null | sort`],
      { user: 'workspace' }
    );

    if (listMsgsResult.exitCode !== 0 || !listMsgsResult.stdout.trim()) {
      return { id: sessionId, messages: [] };
    }

    const messages: SessionMessage[] = [];
    const msgFiles = listMsgsResult.stdout.trim().split('\n').filter(Boolean);

    for (const msgFile of msgFiles) {
      const msgResult = await exec(containerName, ['cat', msgFile], {
        user: 'workspace',
      });
      if (msgResult.exitCode !== 0) continue;

      try {
        const msg = JSON.parse(msgResult.stdout) as {
          id?: string;
          role?: 'user' | 'assistant';
          time?: { created?: number };
        };
        if (!msg.id || (msg.role !== 'user' && msg.role !== 'assistant')) continue;

        const timestamp = msg.time?.created ? new Date(msg.time.created).toISOString() : undefined;

        const listPartsResult = await exec(
          containerName,
          ['bash', '-c', `ls -1 "${partDir}/${msg.id}"/prt_*.json 2>/dev/null | sort`],
          { user: 'workspace' }
        );

        if (listPartsResult.exitCode === 0 && listPartsResult.stdout.trim()) {
          const partFiles = listPartsResult.stdout.trim().split('\n').filter(Boolean);
          for (const partFile of partFiles) {
            const partResult = await exec(containerName, ['cat', partFile], {
              user: 'workspace',
            });
            if (partResult.exitCode !== 0) continue;

            try {
              const part = JSON.parse(partResult.stdout) as {
                type: string;
                text?: string;
                tool?: string;
                callID?: string;
                id?: string;
                state?: {
                  input?: Record<string, unknown>;
                  output?: string;
                  title?: string;
                };
              };
              if (part.type === 'text' && part.text) {
                messages.push({
                  type: msg.role as 'user' | 'assistant',
                  content: part.text,
                  timestamp,
                });
              } else if (part.type === 'tool' && part.tool) {
                messages.push({
                  type: 'tool_use',
                  content: undefined,
                  toolName: part.state?.title || part.tool,
                  toolId: part.callID || part.id,
                  toolInput: JSON.stringify(part.state?.input, null, 2),
                  timestamp,
                });
                if (part.state?.output) {
                  messages.push({
                    type: 'tool_result',
                    content: part.state.output,
                    toolId: part.callID || part.id,
                    timestamp,
                  });
                }
              }
            } catch {
              continue;
            }
          }
        }
      } catch {
        continue;
      }
    }

    return { id: sessionId, messages };
  },
};
