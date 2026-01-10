import type { AgentType, SessionMessage } from '../types';
import type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';
import { claudeProvider } from './claude';
import { opencodeProvider } from './opencode';
import { codexProvider } from './codex';

export type { RawSession, SessionListItem, ExecInContainer, AgentSessionProvider } from './types';
export { claudeProvider } from './claude';
export { opencodeProvider } from './opencode';
export { codexProvider } from './codex';

const providers: Record<AgentType, AgentSessionProvider> = {
  'claude-code': claudeProvider,
  opencode: opencodeProvider,
  codex: codexProvider,
};

export async function discoverAllSessions(
  containerName: string,
  exec: ExecInContainer
): Promise<RawSession[]> {
  const results = await Promise.all([
    claudeProvider.discoverSessions(containerName, exec),
    opencodeProvider.discoverSessions(containerName, exec),
    codexProvider.discoverSessions(containerName, exec),
  ]);

  return results.flat();
}

export async function getSessionDetails(
  containerName: string,
  rawSession: RawSession,
  exec: ExecInContainer
): Promise<SessionListItem | null> {
  const provider = providers[rawSession.agentType];
  if (!provider) return null;
  return provider.getSessionDetails(containerName, rawSession, exec);
}

export async function getSessionMessages(
  containerName: string,
  sessionId: string,
  agentType: AgentType,
  exec: ExecInContainer,
  projectPath?: string
): Promise<{ id: string; agentType: AgentType; messages: SessionMessage[] } | null> {
  const provider = providers[agentType];
  if (!provider) return null;
  const result = await provider.getSessionMessages(containerName, sessionId, exec, projectPath);
  if (!result) return null;
  return { ...result, agentType };
}

export async function findSessionMessages(
  containerName: string,
  sessionId: string,
  exec: ExecInContainer
): Promise<{ id: string; agentType: AgentType; messages: SessionMessage[] } | null> {
  const agentTypes: AgentType[] = ['claude-code', 'opencode', 'codex'];
  for (const agentType of agentTypes) {
    const result = await getSessionMessages(containerName, sessionId, agentType, exec);
    if (result && result.messages.length > 0) {
      return result;
    }
  }
  return null;
}

export async function deleteSession(
  containerName: string,
  sessionId: string,
  agentType: AgentType,
  exec: ExecInContainer
): Promise<{ success: boolean; error?: string }> {
  const provider = providers[agentType];
  if (!provider) {
    return { success: false, error: 'Unknown agent type' };
  }
  return provider.deleteSession(containerName, sessionId, exec);
}

export interface SearchResult {
  sessionId: string;
  agentType: AgentType;
  filePath: string;
  matchCount: number;
}

export async function searchSessions(
  containerName: string,
  query: string,
  exec: ExecInContainer
): Promise<SearchResult[]> {
  const safeQuery = query.replace(/['"\\]/g, '\\$&');

  const searchPaths = [
    '/home/workspace/.claude/projects',
    '/home/workspace/.local/share/opencode/storage',
    '/home/workspace/.codex/sessions',
  ];

  const rgCommand = `rg -l -i --no-messages "${safeQuery}" ${searchPaths.join(' ')} 2>/dev/null | head -100`;

  const result = await exec(containerName, ['bash', '-c', rgCommand], {
    user: 'workspace',
  });

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return [];
  }

  const files = result.stdout.trim().split('\n').filter(Boolean);
  const results: SearchResult[] = [];

  for (const file of files) {
    let sessionId: string | null = null;
    let agentType: AgentType | null = null;

    if (file.includes('/.claude/projects/')) {
      const match = file.match(/\/([^/]+)\.jsonl$/);
      if (match && !match[1].startsWith('agent-')) {
        sessionId = match[1];
        agentType = 'claude-code';
      }
    } else if (file.includes('/.local/share/opencode/storage/')) {
      if (file.includes('/session/') && file.endsWith('.json')) {
        const match = file.match(/\/(ses_[^/]+)\.json$/);
        if (match) {
          sessionId = match[1];
          agentType = 'opencode';
        }
      } else if (file.includes('/part/') || file.includes('/message/')) {
        continue;
      }
    } else if (file.includes('/.codex/sessions/')) {
      const match = file.match(/\/([^/]+)\.jsonl$/);
      if (match) {
        sessionId = match[1];
        agentType = 'codex';
      }
    }

    if (sessionId && agentType) {
      results.push({
        sessionId,
        agentType,
        filePath: file,
        matchCount: 1,
      });
    }
  }

  return results;
}
