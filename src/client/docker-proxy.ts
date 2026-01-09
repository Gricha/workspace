import type { Socket } from 'bun';
import type { PortForward } from "./port-forward";
import { parsePortForward, formatPortForwards } from './port-forward';

export { PortForward, parsePortForward, formatPortForwards };

export interface DockerProxyOptions {
  containerIp: string;
  forwards: PortForward[];
  onConnect?: (port: number) => void;
  onError?: (error: Error) => void;
}

interface ProxySocket {
  upstream: Socket<unknown> | null;
  buffer: Buffer[];
}

export async function startDockerProxy(options: DockerProxyOptions): Promise<() => void> {
  const { containerIp, forwards, onConnect, onError } = options;
  const servers: Array<{ stop: () => void }> = [];

  for (const fwd of forwards) {
    try {
      const server = Bun.listen<ProxySocket>({
        hostname: '0.0.0.0',
        port: fwd.localPort,
        socket: {
          open(socket) {
            socket.data = { upstream: null, buffer: [] };

            Bun.connect<{ downstream: Socket<ProxySocket> }>({
              hostname: containerIp,
              port: fwd.remotePort,
              socket: {
                open(upstream) {
                  socket.data.upstream = upstream;
                  upstream.data = { downstream: socket };
                  for (const chunk of socket.data.buffer) {
                    upstream.write(chunk);
                  }
                  socket.data.buffer = [];
                },
                data(upstream, data) {
                  const downstream = upstream.data?.downstream;
                  if (downstream) {
                    downstream.write(data);
                  }
                },
                close(upstream) {
                  const downstream = upstream.data?.downstream;
                  if (downstream) {
                    downstream.end();
                  }
                },
                error(upstream, err) {
                  const downstream = upstream.data?.downstream;
                  if (downstream) {
                    downstream.end();
                  }
                  if (onError) onError(err);
                },
              },
            }).catch((err) => {
              socket.end();
              if (onError) onError(err);
            });
          },
          data(socket, data) {
            if (socket.data.upstream) {
              socket.data.upstream.write(data);
            } else {
              socket.data.buffer.push(Buffer.from(data));
            }
          },
          close(socket) {
            if (socket.data.upstream) {
              socket.data.upstream.end();
            }
          },
          error(socket, err) {
            if (socket.data.upstream) {
              socket.data.upstream.end();
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
