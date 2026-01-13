import type { Subprocess } from 'bun';
import type { AgentAdapter, AdapterStartOptions, SessionStatus } from '../types';
import type { ChatMessage } from '../../chat/types';
import { execInContainer } from '../../docker';
import { ensureOpenCodeServer } from '../opencode/server';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (status: SessionStatus) => void;
type ErrorCallback = (error: Error) => void;

interface OpenCodeServerEvent {
  type: string;
  properties: {
    sessionID?: string;
    part?: {
      id: string;
      sessionID?: string;
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
const SSE_TIMEOUT_MS = 10 * 60 * 1000;

export class OpenCodeAdapter implements AgentAdapter {
  readonly agentType = 'opencode' as const;

  private containerName?: string;
  private agentSessionId?: string;
  private model?: string;
  private status: SessionStatus = 'idle';
  private port?: number;
  private isHost = false;
  private projectPath?: string;

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

  setModel(model: string): void {
    this.model = model;
  }

  async start(options: AdapterStartOptions): Promise<void> {
    this.isHost = options.isHost;
    this.containerName = options.containerName;
    this.agentSessionId = options.agentSessionId;
    this.model = options.model;
    this.projectPath = options.projectPath;

    try {
      this.port = await ensureOpenCodeServer({
        isHost: this.isHost,
        containerName: this.containerName,
        projectPath: this.projectPath,
      });
      this.setStatus('idle');
    } catch (err) {
      this.emitError(err as Error);
      throw err;
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
      if (this.agentSessionId) {
        const exists = await this.sessionExists(baseUrl, this.agentSessionId);
        if (!exists) {
          throw new Error(
            `OpenCode session not found on server: ${this.agentSessionId}. ` +
              `Refusing to create a new session automatically. ` +
              `This usually means the opencode server is running in a different projectPath or was restarted.`
          );
        }
      }

      if (!this.agentSessionId) {
        this.agentSessionId = await this.createSession(baseUrl);
        this.emit({ type: 'system', content: `Session: ${this.agentSessionId.slice(0, 8)}...` });
        this.statusCallback?.(this.status);
      }

      this.setStatus('running');
      this.emit({ type: 'system', content: 'Processing...' });

      await this.sendAndStream(baseUrl, message);

      this.setStatus('idle');
      this.emit({ type: 'done', content: 'Response complete', messageId: this.currentMessageId });
      this.currentMessageId = undefined;
    } catch (err) {
      this.cleanup();
      this.currentMessageId = undefined;
      this.setStatus('error');
      this.emitError(err as Error);
      throw err;
    }
  }

  private async sessionExists(baseUrl: string, sessionId: string): Promise<boolean> {
    try {
      if (this.isHost) {
        const response = await fetch(`${baseUrl}/session/${sessionId}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      }

      const result = await execInContainer(
        this.containerName!,
        [
          'curl',
          '-s',
          '-o',
          '/dev/null',
          '-w',
          '%{http_code}',
          '--max-time',
          '5',
          `${baseUrl}/session/${sessionId}`,
        ],
        { user: 'workspace' }
      );
      return result.stdout.trim() === '200';
    } catch {
      return false;
    }
  }

  private async createSession(baseUrl: string): Promise<string> {
    const payload = {};

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
    let sseError: Error | null = null;
    const sseReady = this.startSSEStream().catch((err) => {
      sseError = err;
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const payload: Record<string, unknown> = { parts: [{ type: 'text', text: message }] };
    if (this.model) {
      payload.model = this.model;
    }

    if (this.isHost) {
      const response = await fetch(`${baseUrl}/session/${this.agentSessionId}/prompt_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MESSAGE_TIMEOUT_MS),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    } else {
      const result = await execInContainer(
        this.containerName!,
        [
          'curl',
          '-s',
          '-w',
          '%{http_code}',
          '-o',
          '/dev/null',
          '--max-time',
          String(MESSAGE_TIMEOUT_MS / 1000),
          '-X',
          'POST',
          `${baseUrl}/session/${this.agentSessionId}/prompt_async`,
          '-H',
          'Content-Type: application/json',
          '-d',
          JSON.stringify(payload),
        ],
        { user: 'workspace' }
      );

      const httpCode = result.stdout.trim();
      if (result.exitCode !== 0 || (httpCode !== '204' && httpCode !== '200')) {
        throw new Error(`Failed to send message: ${result.stderr || `HTTP ${httpCode}`}`);
      }
    }

    await sseReady;
    if (sseError) {
      throw sseError;
    }
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
      let eventCount = 0;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      const timeout = setTimeout(() => {
        proc.kill();
        if (resolved) return;
        resolved = true;
        reject(new Error('SSE stream timeout'));
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
                eventCount++;

                if (event.type === 'session.idle') {
                  const idleSessionId = event.properties?.sessionID;
                  if (!idleSessionId || idleSessionId !== this.agentSessionId) {
                    continue;
                  }
                  receivedIdle = true;
                  clearTimeout(timeout);
                  proc.kill();
                  finish();
                  return;
                }

                if (event.type === 'message.part.updated' && event.properties.part) {
                  const part = event.properties.part;
                  if (!part.sessionID || part.sessionID !== this.agentSessionId) {
                    continue;
                  }

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
                // skip
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
          reject(
            new Error(
              `SSE stream ended unexpectedly without session.idle (received ${eventCount} events)`
            )
          );
        }
      })().catch((err) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
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
    this.currentMessageId = undefined;
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
