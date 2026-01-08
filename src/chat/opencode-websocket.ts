import { WebSocket } from 'ws';
import {
  BaseChatWebSocketServer,
  type BaseChatConnection,
  type BaseChatWebSocketOptions,
  type ChatSessionInterface,
} from './base-chat-websocket';
import { createOpencodeSession } from './opencode-handler';
import { createHostOpencodeSession } from './host-opencode-handler';
import { createOpenCodeServerSession } from './opencode-server';
import type { ChatMessage } from './handler';
import type { AgentConfig } from '../shared/types';

type AnyOpencodeSession =
  | ReturnType<typeof createOpencodeSession>
  | ReturnType<typeof createHostOpencodeSession>
  | ReturnType<typeof createOpenCodeServerSession>;

interface OpencodeConnection extends BaseChatConnection {
  session: AnyOpencodeSession | null;
}

interface OpencodeWebSocketOptions extends BaseChatWebSocketOptions {
  getConfig?: () => AgentConfig;
}

export class OpencodeWebSocketServer extends BaseChatWebSocketServer<OpencodeConnection> {
  protected agentType = 'opencode';
  private getConfig?: () => AgentConfig;

  constructor(options: OpencodeWebSocketOptions) {
    super(options);
    this.getConfig = options.getConfig;
  }

  protected createConnection(ws: WebSocket, workspaceName: string): OpencodeConnection {
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
    _projectPath?: string
  ): ChatSessionInterface {
    const model = messageModel || this.getConfig?.()?.agents?.opencode?.model;
    return createHostOpencodeSession({ sessionId, model }, onMessage);
  }

  protected createContainerSession(
    containerName: string,
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void,
    messageModel?: string
  ): ChatSessionInterface {
    const model = messageModel || this.getConfig?.()?.agents?.opencode?.model;
    return createOpenCodeServerSession(
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
