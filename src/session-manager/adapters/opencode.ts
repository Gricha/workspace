import type { Subprocess } from 'bun';
import type { AgentAdapter, AdapterStartOptions, SessionStatus } from '../types';
import type { ChatMessage } from '../../chat/types';
import { execInContainer } from '../../docker';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (status: SessionStatus) => void;
type ErrorCallback = (error: Error) => void;

interface OpenCodeServerEvent {
  type: string;
  properties: {
    part?: {
      id: string;
      messageID?: string;
      type: string;
      tool?: string;
      state?: {
        status?: string;
        input?: Record<string, unknown>;
        output?: string;
        title?: string;
      };
    };
    delta?: string;
  };
}

const MESSAGE_TIMEOUT_MS = 30000;
const SSE_TIMEOUT_MS = 120000;

const serverPorts = new Map<string, number>();
const serverStarting = new Map<string, Promise<number>>();

let hostServerPort: number | null = null;
let hostServerStarting: Promise<number> | null = null;
let hostServerProcess: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;

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

async function getServerLogs(containerName: string): Promise<string> {
  try {
    const result = await execInContainer(
      containerName,
      ['tail', '-20', '/tmp/opencode-server.log'],
      {
        user: 'workspace',
      }
    );
    return result.stdout;
  } catch {
    return '(no logs available)';
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
    console.log(`[opencode] Starting server on port ${port} in ${containerName}`);

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
        console.log(`[opencode] Server ready on port ${port}`);
        serverPorts.set(containerName, port);
        serverStarting.delete(containerName);
        return port;
      }
    }

    serverStarting.delete(containerName);
    const logs = await getServerLogs(containerName);
    throw new Error(`Failed to start OpenCode server. Logs:\n${logs}`);
  })();

  serverStarting.set(containerName, startPromise);
  return startPromise;
}

export class OpenCodeAdapter implements AgentAdapter {
  readonly agentType = 'opencode' as const;

  private containerName?: string;
  private agentSessionId?: string;
  private model?: string;
  private status: SessionStatus = 'idle';
  private port?: number;
  private isHost = false;
  private sseProcess: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private currentMessageId?: string;

  private messageCallback?: MessageCallback;
  private statusCallback?: StatusCallback;
  private errorCallback?: ErrorCallback;

  onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  async start(options: AdapterStartOptions): Promise<void> {
    this.isHost = options.isHost;
    this.containerName = options.containerName;
    this.agentSessionId = options.agentSessionId;
    this.model = options.model;

    try {
      if (this.isHost) {
        this.port = await this.startServerHost();
      } else {
        this.port = await startServer(this.containerName!);
      }
      this.setStatus('idle');
    } catch (err) {
      this.emitError(err as Error);
      throw err;
    }
  }

  private async startServerHost(): Promise<number> {
    if (hostServerPort && (await this.isServerRunningHost(hostServerPort))) {
      return hostServerPort;
    }

    if (hostServerStarting) {
      return hostServerStarting;
    }

    const startPromise = (async () => {
      const port = await this.findAvailablePortHost();

      console.log(`[opencode] Starting server on port ${port} on host`);

      hostServerProcess = Bun.spawn(
        ['opencode', 'serve', '--port', String(port), '--hostname', '127.0.0.1'],
        {
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await this.isServerRunningHost(port)) {
          console.log(`[opencode] Server ready on port ${port}`);
          hostServerPort = port;
          hostServerStarting = null;
          return port;
        }
      }

      hostServerStarting = null;
      if (hostServerProcess) {
        hostServerProcess.kill();
        await hostServerProcess.exited;
        hostServerProcess = null;
      }
      throw new Error('Failed to start OpenCode server on host');
    })();

    hostServerStarting = startPromise;
    return startPromise;
  }

  private async findAvailablePortHost(): Promise<number> {
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response(''),
    });
    const port = server.port!;
    server.stop();
    return port;
  }

  private async isServerRunningHost(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/session`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.port) {
      const err = new Error('Adapter not started');
      this.emitError(err);
      throw err;
    }

    if (this.status === 'running') {
      const err = new Error('Session is already processing a message');
      this.emitError(err);
      throw err;
    }

    const baseUrl = `http://localhost:${this.port}`;

    try {
      if (!this.agentSessionId) {
        this.agentSessionId = await this.createSession(baseUrl);
        this.emit({ type: 'system', content: `Session: ${this.agentSessionId.slice(0, 8)}...` });
      }

      this.setStatus('running');
      this.emit({ type: 'system', content: 'Processing...' });

      await this.sendAndStream(baseUrl, message);

      this.setStatus('idle');
      this.emit({ type: 'done', content: 'Response complete', messageId: this.currentMessageId });
      this.currentMessageId = undefined;
    } catch (err) {
      this.cleanup();
      this.setStatus('error');
      this.emitError(err as Error);
      this.emit({ type: 'error', content: (err as Error).message });
      throw err;
    }
  }

  private async createSession(baseUrl: string): Promise<string> {
    const payload = this.model ? { model: this.model } : {};

    if (this.isHost) {
      const response = await fetch(`${baseUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MESSAGE_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const session = await response.json();
      return session.id;
    }

    const result = await execInContainer(
      this.containerName!,
      [
        'curl',
        '-s',
        '-f',
        '--max-time',
        String(MESSAGE_TIMEOUT_MS / 1000),
        '-X',
        'POST',
        `${baseUrl}/session`,
        '-H',
        'Content-Type: application/json',
        '-d',
        JSON.stringify(payload),
      ],
      { user: 'workspace' }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create session: ${result.stderr || 'Unknown error'}`);
    }

    const session = JSON.parse(result.stdout);
    return session.id;
  }

  private async sendAndStream(baseUrl: string, message: string): Promise<void> {
    const sseReady = this.startSSEStream();

    await new Promise((resolve) => setTimeout(resolve, 100));

    const payload = { parts: [{ type: 'text', text: message }] };

    if (this.isHost) {
      const response = await fetch(`${baseUrl}/session/${this.agentSessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MESSAGE_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    } else {
      const result = await execInContainer(
        this.containerName!,
        [
          'curl',
          '-s',
          '-f',
          '--max-time',
          String(MESSAGE_TIMEOUT_MS / 1000),
          '-X',
          'POST',
          `${baseUrl}/session/${this.agentSessionId}/message`,
          '-H',
          'Content-Type: application/json',
          '-d',
          JSON.stringify(payload),
        ],
        { user: 'workspace' }
      );

      if (result.exitCode !== 0) {
        throw new Error(`Failed to send message: ${result.stderr || 'Connection failed'}`);
      }
    }

    await sseReady;
  }

  private startSSEStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      const seenTools = new Set<string>();
      let resolved = false;
      let receivedIdle = false;

      const curlArgs = [
        'curl',
        '-s',
        '-N',
        '--max-time',
        String(SSE_TIMEOUT_MS / 1000),
        `http://localhost:${this.port}/event`,
      ];

      const spawnArgs = this.isHost
        ? curlArgs
        : ['docker', 'exec', '-i', this.containerName!, ...curlArgs];

      const proc = Bun.spawn(spawnArgs, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });

      this.sseProcess = proc;
      const decoder = new TextDecoder();
      let buffer = '';

      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        proc.kill();
        if (!resolved) {
          resolved = true;
          reject(new Error('SSE stream timeout'));
        }
      }, SSE_TIMEOUT_MS);

      (async () => {
        if (!proc.stdout) {
          clearTimeout(timeout);
          reject(new Error('Failed to start SSE stream'));
          return;
        }

        try {
          for await (const chunk of proc.stdout) {
            buffer += decoder.decode(chunk);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const event: OpenCodeServerEvent = JSON.parse(data);

                if (event.type === 'session.idle') {
                  receivedIdle = true;
                  clearTimeout(timeout);
                  proc.kill();
                  finish();
                  return;
                }

                if (event.type === 'message.part.updated' && event.properties.part) {
                  const part = event.properties.part;

                  if (part.messageID) {
                    this.currentMessageId = part.messageID;
                  }

                  if (part.type === 'text' && event.properties.delta) {
                    this.emit({
                      type: 'assistant',
                      content: event.properties.delta,
                      messageId: this.currentMessageId,
                    });
                  } else if (part.type === 'tool' && part.tool && !seenTools.has(part.id)) {
                    seenTools.add(part.id);
                    this.emit({
                      type: 'tool_use',
                      content: JSON.stringify(part.state?.input, null, 2),
                      toolName: part.state?.title || part.tool,
                      toolId: part.id,
                      messageId: this.currentMessageId,
                    });

                    if (part.state?.status === 'completed' && part.state?.output) {
                      this.emit({
                        type: 'tool_result',
                        content: part.state.output,
                        toolId: part.id,
                        messageId: this.currentMessageId,
                      });
                    }
                  }
                }
              } catch {
                // Invalid JSON, skip
              }
            }
          }
        } catch (err) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
          return;
        }

        clearTimeout(timeout);
        if (receivedIdle) {
          finish();
        } else if (!resolved) {
          resolved = true;
          reject(new Error('SSE stream ended unexpectedly without session.idle'));
        }
      })();
    });
  }

  private cleanup(): void {
    if (this.sseProcess) {
      this.sseProcess.kill();
      this.sseProcess = null;
    }
  }

  async interrupt(): Promise<void> {
    this.cleanup();
    if (this.status === 'running') {
      this.setStatus('interrupted');
      this.emit({ type: 'system', content: 'Interrupted' });
    }
  }

  async dispose(): Promise<void> {
    await this.interrupt();
  }

  getAgentSessionId(): string | undefined {
    return this.agentSessionId;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.statusCallback?.(status);
  }

  private emit(msg: Omit<ChatMessage, 'timestamp'>): void {
    this.messageCallback?.({ ...msg, timestamp: new Date().toISOString() });
  }

  private emitError(error: Error): void {
    this.errorCallback?.(error);
  }
}
