import { WebSocket } from 'ws';
import {
  BaseChatWebSocketServer,
  type BaseChatConnection,
  type BaseChatWebSocketOptions,
  type ChatSessionInterface,
} from './base-chat-websocket';
import { createChatSession, type ChatMessage } from './handler';
import { createHostChatSession } from './host-handler';
import type { AgentConfig } from '../shared/types';

type AnyChatSession =
  | ReturnType<typeof createChatSession>
  | ReturnType<typeof createHostChatSession>;

interface ChatConnection extends BaseChatConnection {
  session: AnyChatSession | null;
}

interface ChatWebSocketOptions extends BaseChatWebSocketOptions {
  getConfig: () => AgentConfig;
}

export class ChatWebSocketServer extends BaseChatWebSocketServer<ChatConnection> {
  private getConfig: () => AgentConfig;
  protected agentType = '';

  constructor(options: ChatWebSocketOptions) {
    super(options);
    this.getConfig = options.getConfig;
  }

  protected createConnection(ws: WebSocket, workspaceName: string): ChatConnection {
    return {
      ws,
      session: null,
      workspaceName,
    };
  }

  protected createHostSession(
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void,
    messageModel?: string,
    projectPath?: string
  ): ChatSessionInterface {
    const config = this.getConfig();
    const model = messageModel || config.agents?.claude_code?.model;
    return createHostChatSession({ sessionId, model, workDir: projectPath }, onMessage);
  }

  protected createContainerSession(
    containerName: string,
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void,
    messageModel?: string
  ): ChatSessionInterface {
    const config = this.getConfig();
    const model = messageModel || config.agents?.claude_code?.model;
    return createChatSession(
      {
        containerName,
        workDir: '/home/workspace',
        sessionId,
        model,
      },
      onMessage
    );
  }
}
