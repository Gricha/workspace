import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection, safeSend } from '../shared/base-websocket';
import { createTerminalSession, TerminalSession } from './handler';
import { createHostTerminalSession, HostTerminalSession } from './host-handler';
import { isControlMessage } from './types';
import { HOST_WORKSPACE_NAME } from '../shared/types';

type AnyTerminalSession = TerminalSession | HostTerminalSession;

interface TerminalConnection extends BaseConnection {
  session: AnyTerminalSession;
}

export class TerminalWebSocketServer extends BaseWebSocketServer<TerminalConnection> {
  private getContainerName: (workspaceName: string) => string;
  private isHostAccessAllowed: () => boolean;

  constructor(options: {
    getContainerName: (workspaceName: string) => string;
    isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
    isHostAccessAllowed?: () => boolean;
  }) {
    super({ isWorkspaceRunning: options.isWorkspaceRunning });
    this.getContainerName = options.getContainerName;
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const isHostMode = workspaceName === HOST_WORKSPACE_NAME;

    if (isHostMode && !this.isHostAccessAllowed()) {
      ws.close(4003, 'Host access is disabled');
      return;
    }

    let session: AnyTerminalSession | null = null;
    let started = false;

    const startSession = (cols: number, rows: number) => {
      if (started) return;
      started = true;

      if (isHostMode) {
        session = createHostTerminalSession({
          size: { cols, rows },
        });
      } else {
        const containerName = this.getContainerName(workspaceName);
        session = createTerminalSession({
          containerName,
          user: 'workspace',
          size: { cols, rows },
        });
      }

      const connection: TerminalConnection = {
        ws,
        session,
        workspaceName,
      };
      this.connections.set(ws, connection);

      session.setOnData((data) => {
        safeSend(ws, data);
      });

      session.setOnExit((code) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, `Process exited with code ${code}`);
        }
        this.connections.delete(ws);
      });

      try {
        session.start();
      } catch (err) {
        console.error('Failed to start terminal session:', err);
        ws.close(1011, 'Failed to start terminal');
        this.connections.delete(ws);
      }
    };

    ws.on('message', (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      if (str.startsWith('{')) {
        try {
          const message = JSON.parse(str);
          if (isControlMessage(message)) {
            if (!started) {
              startSession(message.cols, message.rows);
            } else if (session) {
              session.resize({ cols: message.cols, rows: message.rows });
            }
            return;
          }
        } catch {
          // Not valid JSON control message, pass through as input
        }
      }

      if (session) {
        session.write(data);
      }
    });

    ws.on('close', () => {
      if (session) {
        session.kill();
      }
      this.connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      if (session) {
        session.kill();
      }
      this.connections.delete(ws);
    });
  }

  protected cleanupConnection(connection: TerminalConnection): void {
    connection.session.kill();
  }

  getConnectionsForWorkspace(workspaceName: string): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.workspaceName === workspaceName) {
        count++;
      }
    }
    return count;
  }
}
