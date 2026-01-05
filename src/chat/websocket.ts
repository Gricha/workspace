import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection, safeSend } from '../shared/base-websocket';
import { createChatSession, type ChatSession, type ChatMessage } from './handler';
import { createHostChatSession, type HostChatSession } from './host-handler';
import { getContainerName } from '../docker';
import type { AgentConfig } from '../shared/types';
import { HOST_WORKSPACE_NAME } from '../shared/types';

type AnyChatSession = ChatSession | HostChatSession;

interface ChatConnection extends BaseConnection {
  session: AnyChatSession | null;
}

interface IncomingChatMessage {
  type: 'message' | 'interrupt';
  content?: string;
  sessionId?: string;
}

interface ChatWebSocketOptions {
  isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  getConfig: () => AgentConfig;
  isHostAccessAllowed?: () => boolean;
}

export class ChatWebSocketServer extends BaseWebSocketServer<ChatConnection> {
  private getConfig: () => AgentConfig;
  private isHostAccessAllowed: () => boolean;

  constructor(options: ChatWebSocketOptions) {
    super(options);
    this.getConfig = options.getConfig;
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const isHostMode = workspaceName === HOST_WORKSPACE_NAME;

    if (isHostMode && !this.isHostAccessAllowed()) {
      ws.close(4003, 'Host access is disabled');
      return;
    }
    const connection: ChatConnection = {
      ws,
      session: null,
      workspaceName,
    };
    this.connections.set(ws, connection);

    safeSend(
      ws,
      JSON.stringify({
        type: 'connected',
        workspaceName,
        timestamp: new Date().toISOString(),
      })
    );

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
            const config = this.getConfig();
            const model = config.agents?.claude_code?.model;

            if (isHostMode) {
              connection.session = createHostChatSession(
                {
                  sessionId: message.sessionId,
                  model,
                },
                onMessage
              );
            } else {
              const containerName = getContainerName(workspaceName);
              connection.session = createChatSession(
                {
                  containerName,
                  workDir: '/home/workspace',
                  sessionId: message.sessionId,
                  model,
                },
                onMessage
              );
            }
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
      console.error('Chat WebSocket error:', err);
      const conn = this.connections.get(ws);
      if (conn?.session) {
        conn.session.interrupt().catch(() => {});
      }
      this.connections.delete(ws);
    });
  }

  protected cleanupConnection(connection: ChatConnection): void {
    if (connection.session) {
      connection.session.interrupt().catch(() => {});
    }
  }
}
