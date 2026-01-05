import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';

export interface BaseConnection {
  ws: WebSocket;
  workspaceName: string;
}

export function safeSend(ws: WebSocket, data: string | Buffer): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    ws.send(data);
    return true;
  } catch {
    return false;
  }
}

export abstract class BaseWebSocketServer<TConnection extends BaseConnection> {
  protected wss: WebSocketServer;
  protected connections: Map<WebSocket, TConnection> = new Map();
  protected isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;

  constructor(options: { isWorkspaceRunning: (workspaceName: string) => Promise<boolean> }) {
    this.wss = new WebSocketServer({ noServer: true });
    this.isWorkspaceRunning = options.isWorkspaceRunning;
    this.wss.on('connection', this.onConnection.bind(this));
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

  private onConnection(ws: WebSocket & { workspaceName?: string }): void {
    const workspaceName = ws.workspaceName;
    if (!workspaceName) {
      ws.close(1008, 'Missing workspace name');
      return;
    }

    this.handleConnection(ws, workspaceName);
  }

  protected abstract handleConnection(ws: WebSocket, workspaceName: string): void;

  protected abstract cleanupConnection(connection: TConnection): void;

  getConnectionCount(): number {
    return this.connections.size;
  }

  closeConnectionsForWorkspace(workspaceName: string): void {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.workspaceName === workspaceName) {
        this.cleanupConnection(conn);
        ws.close(1001, 'Workspace stopped');
        this.connections.delete(ws);
      }
    }
  }

  close(): void {
    for (const [ws, conn] of this.connections.entries()) {
      this.cleanupConnection(conn);
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    this.wss.close();
  }
}
