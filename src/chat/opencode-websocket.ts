import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection } from '../shared/base-websocket';
import { createOpencodeSession, type OpencodeSession } from './opencode-handler';
import { createHostOpencodeSession, type HostOpencodeSession } from './host-opencode-handler';
import type { ChatMessage } from './handler';
import { getContainerName } from '../docker';
import { HOST_WORKSPACE_NAME } from '../shared/types';

type AnyOpencodeSession = OpencodeSession | HostOpencodeSession;

interface OpencodeConnection extends BaseConnection {
  session: AnyOpencodeSession | null;
}

interface IncomingMessage {
  type: 'message' | 'interrupt';
  content?: string;
  sessionId?: string;
}

interface OpencodeWebSocketOptions {
  isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  isHostAccessAllowed?: () => boolean;
}

export class OpencodeWebSocketServer extends BaseWebSocketServer<OpencodeConnection> {
  private isHostAccessAllowed: () => boolean;

  constructor(options: OpencodeWebSocketOptions) {
    super(options);
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const isHostMode = workspaceName === HOST_WORKSPACE_NAME;

    if (isHostMode && !this.isHostAccessAllowed()) {
      ws.close(4003, 'Host access is disabled');
      return;
    }

    const connection: OpencodeConnection = {
      ws,
      session: null,
      workspaceName,
    };
    this.connections.set(ws, connection);

    ws.send(
      JSON.stringify({
        type: 'connected',
        workspaceName,
        agentType: 'opencode',
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('message', async (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      try {
        const message: IncomingMessage = JSON.parse(str);

        if (message.type === 'interrupt') {
          if (connection.session) {
            await connection.session.interrupt();
            connection.session = null;
          }
          return;
        }

        if (message.type === 'message' && message.content) {
          const onMessage = (chatMessage: ChatMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMessage));
            }
          };

          if (!connection.session) {
            if (isHostMode) {
              connection.session = createHostOpencodeSession(
                {
                  sessionId: message.sessionId,
                },
                onMessage
              );
            } else {
              const containerName = getContainerName(workspaceName);
              connection.session = createOpencodeSession(
                {
                  containerName,
                  workDir: '/home/workspace',
                  sessionId: message.sessionId,
                },
                onMessage
              );
            }
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
      console.error('OpenCode WebSocket error:', err);
      const conn = this.connections.get(ws);
      if (conn?.session) {
        conn.session.interrupt().catch(() => {});
      }
      this.connections.delete(ws);
    });
  }

  protected cleanupConnection(connection: OpencodeConnection): void {
    if (connection.session) {
      connection.session.interrupt().catch(() => {});
    }
  }
}
