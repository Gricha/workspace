import type { Socket } from 'bun';
import type { PortForward } from './port-forward';
import { parsePortForward, formatPortForwards } from './port-forward';

export { PortForward, parsePortForward, formatPortForwards };

export interface DockerProxyOptions {
  containerIp: string;
  forwards: PortForward[];
  onConnect?: (port: number) => void;
  onError?: (error: Error) => void;
}

interface SocketData {
  peer: Socket<SocketData> | null;
  pendingWrite: Buffer[];
  peerClosed: boolean;
}

function flushPending(socket: Socket<SocketData>): void {
  while (socket.data.pendingWrite.length > 0) {
    const chunk = socket.data.pendingWrite[0];
    const written = socket.write(chunk);
    if (written === 0) {
      break;
    }
    if (written < chunk.length) {
      socket.data.pendingWrite[0] = chunk.subarray(written);
      break;
    }
    socket.data.pendingWrite.shift();
  }
}

function writeToSocket(socket: Socket<SocketData>, data: Buffer | Uint8Array): void {
  if (socket.data.pendingWrite.length > 0) {
    socket.data.pendingWrite.push(Buffer.from(data));
    return;
  }
  const written = socket.write(data);
  if (written < data.length) {
    socket.data.pendingWrite.push(Buffer.from(data).subarray(written));
  }
}

export async function startDockerProxy(options: DockerProxyOptions): Promise<() => void> {
  const { containerIp, forwards, onConnect, onError } = options;
  const servers: Array<{ stop: () => void }> = [];

  for (const fwd of forwards) {
    try {
      const server = Bun.listen<SocketData>({
        hostname: '0.0.0.0',
        port: fwd.localPort,
        socket: {
          open(downstream) {
            downstream.data = { peer: null, pendingWrite: [], peerClosed: false };

            Bun.connect<SocketData>({
              hostname: containerIp,
              port: fwd.remotePort,
              socket: {
                open(upstream) {
                  upstream.data = { peer: downstream, pendingWrite: [], peerClosed: false };
                  downstream.data.peer = upstream;
                  for (const chunk of downstream.data.pendingWrite) {
                    writeToSocket(upstream, chunk);
                  }
                  downstream.data.pendingWrite = [];
                },
                data(upstream, data) {
                  const downstream = upstream.data.peer;
                  if (downstream) {
                    writeToSocket(downstream, data);
                  }
                },
                drain(upstream) {
                  flushPending(upstream);
                },
                close(upstream) {
                  upstream.data.peerClosed = true;
                  const downstream = upstream.data.peer;
                  if (downstream && downstream.data.pendingWrite.length === 0) {
                    downstream.end();
                  }
                },
                error(upstream, err) {
                  const downstream = upstream.data.peer;
                  if (downstream) {
                    downstream.end();
                  }
                  if (onError) onError(err);
                },
              },
            }).catch((err) => {
              downstream.end();
              if (onError) onError(err);
            });
          },
          data(downstream, data) {
            const upstream = downstream.data.peer;
            if (upstream) {
              writeToSocket(upstream, data);
            } else {
              downstream.data.pendingWrite.push(Buffer.from(data));
            }
          },
          drain(downstream) {
            flushPending(downstream);
            if (downstream.data.peerClosed && downstream.data.pendingWrite.length === 0) {
              downstream.end();
            }
          },
          close(downstream) {
            downstream.data.peerClosed = true;
            const upstream = downstream.data.peer;
            if (upstream && upstream.data.pendingWrite.length === 0) {
              upstream.end();
            }
          },
          error(downstream, err) {
            const upstream = downstream.data.peer;
            if (upstream) {
              upstream.end();
            }
            if (onError) onError(err);
          },
        },
      });

      servers.push(server);
      if (onConnect) onConnect(fwd.localPort);
    } catch (err) {
      if (onError) onError(err as Error);
    }
  }

  return () => {
    for (const server of servers) {
      server.stop();
    }
  };
}
