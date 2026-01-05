import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';
import { execInContainer } from '../docker';

interface OpenCodeServerEvent {
  type: string;
  properties: {
    info?: {
      id: string;
      sessionID?: string;
      role?: string;
    };
    part?: {
      id: string;
      sessionID: string;
      messageID: string;
      type: string;
      text?: string;
      tool?: string;
      state?: {
        input?: Record<string, unknown>;
        output?: string;
        title?: string;
      };
    };
    delta?: string;
    sessionID?: string;
    status?: { type: string };
  };
}

export interface OpenCodeServerOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
}

const serverPorts = new Map<string, number>();
const serverStarting = new Map<string, Promise<number>>();

async function findAvailablePort(containerName: string): Promise<number> {
  const script = `import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()`;
  const result = await execInContainer(containerName, ['python3', '-c', script], {
    user: 'workspace',
  });
  return parseInt(result.stdout.trim(), 10);
}

async function isServerRunning(containerName: string, port: number): Promise<boolean> {
  try {
    const result = await execInContainer(
      containerName,
      ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', `http://localhost:${port}/session`],
      { user: 'workspace' }
    );
    return result.stdout.trim() === '200';
  } catch {
    return false;
  }
}

async function startServer(containerName: string): Promise<number> {
  const existing = serverPorts.get(containerName);
  if (existing && (await isServerRunning(containerName, existing))) {
    return existing;
  }

  const starting = serverStarting.get(containerName);
  if (starting) {
    return starting;
  }

  const startPromise = (async () => {
    const port = await findAvailablePort(containerName);
    console.log(`[opencode-server] Starting server on port ${port} in ${containerName}`);

    await execInContainer(
      containerName,
      [
        'sh',
        '-c',
        `nohup opencode serve --port ${port} --hostname 127.0.0.1 > /tmp/opencode-server.log 2>&1 &`,
      ],
      { user: 'workspace' }
    );

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await isServerRunning(containerName, port)) {
        console.log(`[opencode-server] Server started on port ${port}`);
        serverPorts.set(containerName, port);
        serverStarting.delete(containerName);
        return port;
      }
    }

    serverStarting.delete(containerName);
    throw new Error('Failed to start OpenCode server');
  })();

  serverStarting.set(containerName, startPromise);
  return startPromise;
}

export class OpenCodeServerSession {
  private containerName: string;
  private workDir: string;
  private sessionId?: string;
  private onMessage: (message: ChatMessage) => void;
  private sseProcess: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private responseComplete = false;

  constructor(options: OpenCodeServerOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/home/workspace';
    this.sessionId = options.sessionId;
    this.onMessage = onMessage;
  }

  async sendMessage(userMessage: string): Promise<void> {
    const port = await startServer(this.containerName);
    const baseUrl = `http://localhost:${port}`;

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.sessionId) {
        const createResult = await execInContainer(
          this.containerName,
          [
            'curl',
            '-s',
            '-X',
            'POST',
            `${baseUrl}/session`,
            '-H',
            'Content-Type: application/json',
            '-d',
            '{}',
          ],
          { user: 'workspace' }
        );
        const session = JSON.parse(createResult.stdout);
        this.sessionId = session.id;
        this.onMessage({
          type: 'system',
          content: `Session started ${this.sessionId}`,
          timestamp: new Date().toISOString(),
        });
      }

      this.responseComplete = false;
      const ssePromise = this.startSSEStream(port);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messagePayload = JSON.stringify({
        parts: [{ type: 'text', text: userMessage }],
      });

      execInContainer(
        this.containerName,
        [
          'curl',
          '-s',
          '-X',
          'POST',
          `${baseUrl}/session/${this.sessionId}/message`,
          '-H',
          'Content-Type: application/json',
          '-d',
          messagePayload,
        ],
        { user: 'workspace' }
      ).catch((err) => {
        console.error('[opencode-server] Send error:', err);
      });

      await ssePromise;

      this.onMessage({
        type: 'done',
        content: 'Response complete',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[opencode-server] Error:', err);
      this.onMessage({
        type: 'error',
        content: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async startSSEStream(port: number): Promise<void> {
    return new Promise((resolve) => {
      const proc = Bun.spawn(
        [
          'docker',
          'exec',
          '-i',
          this.containerName,
          'curl',
          '-s',
          '-N',
          '--max-time',
          '120',
          `http://localhost:${port}/event`,
        ],
        {
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );

      this.sseProcess = proc;

      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = (chunk: Uint8Array) => {
        buffer += decoder.decode(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event: OpenCodeServerEvent = JSON.parse(data);
            this.handleEvent(event);

            if (
              event.type === 'message.part.updated' &&
              event.properties.part?.type === 'step-finish'
            ) {
              this.responseComplete = true;
              proc.kill();
              resolve();
              return;
            }
          } catch {
            continue;
          }
        }
      };

      (async () => {
        if (!proc.stdout) {
          resolve();
          return;
        }

        for await (const chunk of proc.stdout) {
          processChunk(chunk);
          if (this.responseComplete) break;
        }

        resolve();
      })();

      setTimeout(() => {
        if (!this.responseComplete) {
          proc.kill();
          resolve();
        }
      }, 120000);
    });
  }

  private handleEvent(event: OpenCodeServerEvent): void {
    const timestamp = new Date().toISOString();

    if (event.type === 'message.part.updated' && event.properties.part) {
      const part = event.properties.part;

      if (part.type === 'text' && event.properties.delta) {
        this.onMessage({
          type: 'assistant',
          content: event.properties.delta,
          timestamp,
        });
      } else if (part.type === 'tool-use' && part.tool) {
        const input = part.state?.input;
        this.onMessage({
          type: 'tool_use',
          content: JSON.stringify(input, null, 2),
          toolName: part.state?.title || part.tool,
          toolId: part.id,
          timestamp,
        });
      } else if (part.type === 'tool-result' && part.state?.output) {
        this.onMessage({
          type: 'tool_result',
          content: part.state.output,
          toolId: part.id,
          timestamp,
        });
      }
    }
  }

  async interrupt(): Promise<void> {
    if (this.sseProcess) {
      this.sseProcess.kill();
      this.sseProcess = null;
      this.onMessage({
        type: 'system',
        content: 'Chat interrupted',
        timestamp: new Date().toISOString(),
      });
    }
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }
}

export function createOpenCodeServerSession(
  options: OpenCodeServerOptions,
  onMessage: (message: ChatMessage) => void
): OpenCodeServerSession {
  return new OpenCodeServerSession(options, onMessage);
}
