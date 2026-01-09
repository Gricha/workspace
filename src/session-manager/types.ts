import type { ChatMessage } from '../chat/types';

export type SessionStatus = 'idle' | 'running' | 'error' | 'interrupted';

export type AgentType = 'claude' | 'opencode' | 'codex';

export interface SessionInfo {
  id: string;
  workspaceName: string;
  agentType: AgentType;
  status: SessionStatus;
  agentSessionId?: string;
  model?: string;
  startedAt: Date;
  lastActivity: Date;
  error?: string;
}

export interface BufferedMessage {
  id: number;
  message: ChatMessage;
  timestamp: number;
}

export interface SessionClient {
  id: string;
  send: (message: ChatMessage) => void;
  onDisconnect?: () => void;
}

export interface StartSessionOptions {
  workspaceName: string;
  agentType: AgentType;
  sessionId?: string;
  agentSessionId?: string;
  model?: string;
  projectPath?: string;
}

export interface AgentAdapter {
  readonly agentType: AgentType;

  start(options: AdapterStartOptions): Promise<void>;

  sendMessage(message: string): Promise<void>;

  interrupt(): Promise<void>;

  dispose(): Promise<void>;

  getAgentSessionId(): string | undefined;

  getStatus(): SessionStatus;

  onMessage(callback: (message: ChatMessage) => void): void;

  onStatusChange(callback: (status: SessionStatus) => void): void;

  onError(callback: (error: Error) => void): void;
}

export interface AdapterStartOptions {
  workspaceName: string;
  containerName?: string;
  agentSessionId?: string;
  model?: string;
  projectPath?: string;
  isHost: boolean;
}

export interface AdapterFactory {
  create(agentType: AgentType): AgentAdapter;
}
