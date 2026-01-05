import { WebSocket } from 'ws';
import {
  BaseChatWebSocketServer,
  type BaseChatConnection,
  type ChatSessionInterface,
} from './base-chat-websocket';
import { createOpencodeSession } from './opencode-handler';
import { createHostOpencodeSession } from './host-opencode-handler';
import { createOpenCodeServerSession } from './opencode-server';
import type { ChatMessage } from './handler';

type AnyOpencodeSession =
  | ReturnType<typeof createOpencodeSession>
  | ReturnType<typeof createHostOpencodeSession>
  | ReturnType<typeof createOpenCodeServerSession>;

interface OpencodeConnection extends BaseChatConnection {
  session: AnyOpencodeSession | null;
}

export class OpencodeWebSocketServer extends BaseChatWebSocketServer<OpencodeConnection> {
  protected agentType = 'opencode';

  protected createConnection(ws: WebSocket, workspaceName: string): OpencodeConnection {
    return {
      ws,
      session: null,
      workspaceName,
    };
  }

  protected createHostSession(
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void
  ): ChatSessionInterface {
    return createHostOpencodeSession({ sessionId }, onMessage);
  }

  protected createContainerSession(
    containerName: string,
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void
  ): ChatSessionInterface {
    return createOpenCodeServerSession(
      {
        containerName,
        workDir: '/home/workspace',
        sessionId,
      },
      onMessage
    );
  }
}
