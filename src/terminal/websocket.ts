import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection } from '../shared/base-websocket';
import { createTerminalSession, TerminalSession } from './handler';
import { isControlMessage } from './types';

interface TerminalConnection extends BaseConnection {
  session: TerminalSession;
}

export class TerminalWebSocketServer extends BaseWebSocketServer<TerminalConnection> {
  private getContainerName: (workspaceName: string) => string;

  constructor(options: {
    getContainerName: (workspaceName: string) => string;
    isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  }) {
    super({ isWorkspaceRunning: options.isWorkspaceRunning });
    this.getContainerName = options.getContainerName;
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const containerName = this.getContainerName(workspaceName);
    let session: TerminalSession | null = null;
    let started = false;

    const startSession = (cols: number, rows: number) => {
      if (started) return;
      started = true;

      session = createTerminalSession({
        containerName,
        user: 'workspace',
        size: { cols, rows },
      });

      const connection: TerminalConnection = {
        ws,
        session,
        workspaceName,
      };
      this.connections.set(ws, connection);

      session.setOnData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
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
