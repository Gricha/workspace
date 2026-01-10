import type { AgentType, SessionMessage } from '../types';
import type { RawSession, SessionListItem } from './types';
import { createWorkerClient, type WorkerClient } from '../../worker/client';

const clientCache = new Map<string, WorkerClient>();

async function getClient(containerName: string): Promise<WorkerClient> {
  let client = clientCache.get(containerName);
  if (!client) {
    client = await createWorkerClient(containerName);
    clientCache.set(containerName, client);
  }
  return client;
}

export async function discoverSessionsViaWorker(containerName: string): Promise<RawSession[]> {
  const client = await getClient(containerName);
  const sessions = await client.listSessions();

  return sessions.map((s) => ({
    id: s.id,
    agentType: (s.agentType === 'claude' ? 'claude-code' : s.agentType) as AgentType,
    projectPath: s.directory,
    mtime: Math.floor(s.lastActivity / 1000),
    name: s.title || undefined,
    filePath: s.filePath,
  }));
}

export async function getSessionDetailsViaWorker(
  containerName: string,
  rawSession: RawSession
): Promise<SessionListItem | null> {
  const client = await getClient(containerName);
  const session = await client.getSession(rawSession.id);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    name: session.title || null,
    agentType: rawSession.agentType,
    projectPath: session.directory,
    messageCount: session.messageCount,
    lastActivity: new Date(session.lastActivity).toISOString(),
    firstPrompt: session.firstPrompt,
  };
}

export async function getSessionMessagesViaWorker(
  containerName: string,
  sessionId: string
): Promise<{ id: string; messages: SessionMessage[] } | null> {
  const client = await getClient(containerName);
  const result = await client.getMessages(sessionId, { limit: 1000, offset: 0 });

  if (!result || result.messages.length === 0) {
    return null;
  }

  const messages: SessionMessage[] = result.messages.map((m) => ({
    type: m.type,
    content: m.content,
    toolName: m.toolName,
    toolId: m.toolId,
    toolInput: m.toolInput,
    timestamp: m.timestamp,
  }));

  return { id: sessionId, messages };
}

export async function deleteSessionViaWorker(
  containerName: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getClient(containerName);
  return client.deleteSession(sessionId);
}

export function clearWorkerClientCache(containerName?: string): void {
  if (containerName) {
    clientCache.delete(containerName);
  } else {
    clientCache.clear();
  }
}
