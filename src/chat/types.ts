import type { Subprocess } from 'bun';

export interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content: string;
  timestamp: string;
  messageId?: string;
  toolName?: string;
  toolId?: string;
}

export interface ClaudeStreamMessage {
  type: string;
  subtype?: string;
  id?: string;
  session_id?: string;
  model?: string;
  message?: {
    id?: string;
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: unknown;
    }>;
  };
  event?: {
    type: string;
    delta?: {
      type: string;
      text?: string;
    };
  };
  result?: string;
}

export interface OpencodeStreamEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    id?: string;
    sessionID?: string;
    messageID?: string;
    type: string;
    text?: string;
    tool?: string;
    callID?: string;
    state?: {
      status?: string;
      input?: Record<string, unknown>;
      output?: string;
      title?: string;
    };
    reason?: string;
  };
}

export type ChatProcess = Subprocess<'ignore', 'pipe', 'pipe'>;

export type MessageCallback = (message: ChatMessage) => void;

export interface SpawnConfig {
  command: string[];
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  };
}

export interface BaseChatOptions {
  sessionId?: string;
  model?: string;
}

export interface ContainerChatOptions extends BaseChatOptions {
  containerName: string;
  workDir?: string;
}

export interface HostChatOptions extends BaseChatOptions {
  workDir?: string;
}
