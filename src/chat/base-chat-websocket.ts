import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection, safeSend } from '../shared/base-websocket';
import type { ChatMessage } from './handler';
import { getContainerName } from '../docker';
import { HOST_WORKSPACE_NAME } from '../shared/client-types';

export interface ChatSessionInterface {
  sendMessage(content: string): Promise<void>;
  interrupt(): Promise<void>;
  setModel?(model: string): void;
}

export interface BaseChatConnection extends BaseConnection {
  session: ChatSessionInterface | null;
}

export interface IncomingChatMessage {
  type: 'message' | 'interrupt';
  content?: string;
  sessionId?: string;
  model?: string;
  projectPath?: string;
}

export interface BaseChatWebSocketOptions {
  isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  isHostAccessAllowed?: () => boolean;
}

export abstract class BaseChatWebSocketServer<
  TConnection extends BaseChatConnection,
> extends BaseWebSocketServer<TConnection> {
  protected isHostAccessAllowed: () => boolean;
  protected abstract agentType: string;

  constructor(options: BaseChatWebSocketOptions) {
    super(options);
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
  }

  protected abstract createHostSession(
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void,
    model?: string,
    projectPath?: string
  ): ChatSessionInterface;

  protected abstract createContainerSession(
    containerName: string,
    sessionId: string | undefined,
    onMessage: (message: ChatMessage) => void,
    model?: string
  ): ChatSessionInterface;

  protected abstract createConnection(ws: WebSocket, workspaceName: string): TConnection;

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const isHostMode = workspaceName === HOST_WORKSPACE_NAME;

    if (isHostMode && !this.isHostAccessAllowed()) {
      ws.close(4003, 'Host access is disabled');
      return;
    }

    const connection = this.createConnection(ws, workspaceName);
    this.connections.set(ws, connection);

    const connectedMessage: Record<string, unknown> = {
      type: 'connected',
      workspaceName,
      timestamp: new Date().toISOString(),
    };
    if (this.agentType) {
      connectedMessage.agentType = this.agentType;
    }
    safeSend(ws, JSON.stringify(connectedMessage));

    ws.on('message', async (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      try {
        const message: IncomingChatMessage = JSON.parse(str);

        if (message.type === 'interrupt') {
          if (connection.session) {
            await connection.session.interrupt();
            connection.session = null;
          }
          return;
        }

        if (message.type === 'message' && message.content) {
          const onMessage = (chatMessage: ChatMessage) => {
            safeSend(ws, JSON.stringify(chatMessage));
          };

          if (!connection.session) {
            if (isHostMode) {
              connection.session = this.createHostSession(
                message.sessionId,
                onMessage,
                message.model,
                message.projectPath
              );
            } else {
              const containerName = getContainerName(workspaceName);
              connection.session = this.createContainerSession(
                containerName,
                message.sessionId,
                onMessage,
                message.model
              );
            }
          } else if (message.model && connection.session.setModel) {
            connection.session.setModel(message.model);
          }

          await connection.session.sendMessage(message.content);
        }
      } catch (err) {
        safeSend(
          ws,
          JSON.stringify({
            type: 'error',
            content: (err as Error).message,
            timestamp: new Date().toISOString(),
          })
        );
      }
    });

    ws.on('close', () => {
      const conn = this.connections.get(ws);
      if (conn?.session) {
        conn.session.interrupt().catch(() => {});
      }
      this.connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`${this.agentType || 'Chat'} WebSocket error:`, err);
      const conn = this.connections.get(ws);
      if (conn?.session) {
        conn.session.interrupt().catch(() => {});
      }
      this.connections.delete(ws);
    });
  }

  protected cleanupConnection(connection: TConnection): void {
    if (connection.session) {
      connection.session.interrupt().catch(() => {});
    }
  }
}
