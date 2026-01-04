import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection } from '../shared/base-websocket';
import { createChatSession, type ChatSession, type ChatMessage } from './handler';
import { getContainerName } from '../docker';

interface ChatConnection extends BaseConnection {
  session: ChatSession | null;
}

interface IncomingChatMessage {
  type: 'message' | 'interrupt';
  content?: string;
  sessionId?: string;
}

export class ChatWebSocketServer extends BaseWebSocketServer<ChatConnection> {
  constructor(options: { isWorkspaceRunning: (workspaceName: string) => Promise<boolean> }) {
    super(options);
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const connection: ChatConnection = {
      ws,
      session: null,
      workspaceName,
    };
    this.connections.set(ws, connection);

    ws.send(
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
          }
          return;
        }

        if (message.type === 'message' && message.content) {
          const containerName = getContainerName(workspaceName);

          const onMessage = (chatMessage: ChatMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMessage));
            }
          };

          if (!connection.session) {
            connection.session = createChatSession(
              {
                containerName,
                workDir: '/workspace',
                sessionId: message.sessionId,
              },
              onMessage
            );
          }

          await connection.session.sendMessage(message.content);
        }
      } catch (err) {
        ws.send(
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
