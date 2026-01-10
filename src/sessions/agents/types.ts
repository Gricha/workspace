import type { AgentType, SessionMessage } from '../types';

export interface RawSession {
  id: string;
  agentType: AgentType;
  mtime: number;
  projectPath: string;
  filePath: string;
  name?: string;
}

export interface SessionListItem {
  id: string;
  name: string | null;
  agentType: AgentType;
  projectPath: string;
  messageCount: number;
  lastActivity: string;
  firstPrompt: string | null;
}

export interface ContainerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ExecInContainer = (
  containerName: string,
  command: string[],
  options?: { user?: string }
) => Promise<ContainerExecResult>;

export interface AgentSessionProvider {
  discoverSessions(containerName: string, exec: ExecInContainer): Promise<RawSession[]>;

  getSessionDetails(
    containerName: string,
    rawSession: RawSession,
    exec: ExecInContainer
  ): Promise<SessionListItem | null>;

  getSessionMessages(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer,
    projectPath?: string
  ): Promise<{ id: string; messages: SessionMessage[] } | null>;

  deleteSession(
    containerName: string,
    sessionId: string,
    exec: ExecInContainer
  ): Promise<{ success: boolean; error?: string }>;
}
