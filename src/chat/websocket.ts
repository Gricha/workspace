import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { createChatSession, type ChatSession, type ChatMessage } from './handler';
import { getContainerName } from '../docker';

interface ChatConnection {
  ws: WebSocket;
  session: ChatSession | null;
  workspaceName: string;
}

interface IncomingChatMessage {
  type: 'message' | 'interrupt';
  content?: string;
  sessionId?: string;
}

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<WebSocket, ChatConnection> = new Map();
  private isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;

  constructor(options: { isWorkspaceRunning: (workspaceName: string) => Promise<boolean> }) {
    this.wss = new WebSocketServer({ noServer: true });
    this.isWorkspaceRunning = options.isWorkspaceRunning;

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    workspaceName: string
  ): Promise<void> {
    const running = await this.isWorkspaceRunning(workspaceName);
    if (!running) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.end();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as WebSocket & { workspaceName: string }).workspaceName = workspaceName;
      this.wss.emit('connection', ws, request);
    });
  }

  private handleConnection(ws: WebSocket & { workspaceName?: string }): void {
    const workspaceName = ws.workspaceName;
    if (!workspaceName) {
      ws.close(1008, 'Missing workspace name');
      return;
    }

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

  getConnectionCount(): number {
    return this.connections.size;
  }

  closeConnectionsForWorkspace(workspaceName: string): void {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.workspaceName === workspaceName) {
        if (conn.session) {
          conn.session.interrupt().catch(() => {});
        }
        ws.close(1001, 'Workspace stopped');
        this.connections.delete(ws);
      }
    }
  }

  close(): void {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.session) {
        conn.session.interrupt().catch(() => {});
      }
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    this.wss.close();
  }
}
