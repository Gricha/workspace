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
  exec: ExecInContainer
): Promise<{ id: string; agentType: AgentType; messages: SessionMessage[] } | null> {
  const provider = providers[agentType];
  if (!provider) return null;
  const result = await provider.getSessionMessages(containerName, sessionId, exec);
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
