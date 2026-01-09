import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { createHash } from 'crypto';
import { WebSocket } from 'ws';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

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

function manualWebSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  callback: (ws: WebSocket) => void
): void {
  const key = request.headers['sec-websocket-key'];
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const acceptKey = createHash('sha1')
    .update(key + WEBSOCKET_GUID)
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
  ];

  const protocol = request.headers['sec-websocket-protocol'];
  if (protocol) {
    const protocols = protocol.split(',').map((p) => p.trim());
    if (protocols.length > 0) {
      responseHeaders.push(`Sec-WebSocket-Protocol: ${protocols[0]}`);
    }
  }

  responseHeaders.push('', '');
  socket.write(responseHeaders.join('\r\n'));

  const wsOptions = {
    allowSynchronousEvents: true,
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
  };

  const ws = new WebSocket(null as unknown as string, undefined, wsOptions);

  (ws as WebSocket & { setSocket: (socket: Duplex, head: Buffer, opts: object) => void }).setSocket(
    socket,
    head,
    wsOptions
  );

  callback(ws);
}

export abstract class BaseWebSocketServer<TConnection extends BaseConnection> {
  protected connections: Map<WebSocket, TConnection> = new Map();
  protected isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;

  constructor(options: { isWorkspaceRunning: (workspaceName: string) => Promise<boolean> }) {
    this.isWorkspaceRunning = options.isWorkspaceRunning;
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

    manualWebSocketUpgrade(request, socket, head, (ws) => {
      (ws as WebSocket & { workspaceName: string }).workspaceName = workspaceName;
      this.onConnection(ws as WebSocket & { workspaceName: string });
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
  }
}
