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
      callID?: string;
      state?: {
        status?: string;
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

// Configuration for connection management
const HEARTBEAT_TIMEOUT_MS = 45000; // Expect heartbeat every 30s, allow 15s grace
const MESSAGE_SEND_TIMEOUT_MS = 30000; // Timeout for sending a message
const SSE_STREAM_TIMEOUT_MS = 120000; // Overall timeout for SSE stream
const SSE_READY_TIMEOUT_MS = 5000; // Timeout waiting for SSE to become ready

export interface OpenCodeServerOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
  model?: string;
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
  private model?: string;
  private sessionModel?: string;
  private onMessage: (message: ChatMessage) => void;
  private sseProcess: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private responseComplete = false;
  private seenToolUse = new Set<string>();
  private seenToolResult = new Set<string>();
  private lastHeartbeat: number = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private streamError: Error | null = null;

  constructor(options: OpenCodeServerOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/home/workspace';
    this.sessionId = options.sessionId;
    this.model = options.model;
    this.sessionModel = options.model;
    this.onMessage = onMessage;
  }

  /**
   * Check session status from OpenCode server.
   * Returns the session status or null if session doesn't exist.
   */
  async getSessionStatus(port: number): Promise<{ type: 'idle' | 'busy' | 'retry' } | null> {
    if (!this.sessionId) return null;

    try {
      const result = await execInContainer(
        this.containerName,
        [
          'curl',
          '-s',
          '--max-time',
          '5',
          `http://localhost:${port}/session/status`,
        ],
        { user: 'workspace' }
      );

      const statuses = JSON.parse(result.stdout);
      const status = statuses[this.sessionId];
      return status || { type: 'idle' };
    } catch {
      return null;
    }
  }

  /**
   * Verify session exists before attempting to use it.
   */
  async verifySession(port: number): Promise<boolean> {
    if (!this.sessionId) return true; // No session to verify

    try {
      const result = await execInContainer(
        this.containerName,
        [
          'curl',
          '-s',
          '-o',
          '/dev/null',
          '-w',
          '%{http_code}',
          '--max-time',
          '5',
          `http://localhost:${port}/session/${this.sessionId}`,
        ],
        { user: 'workspace' }
      );

      return result.stdout.trim() === '200';
    } catch {
      return false;
    }
  }

  async sendMessage(userMessage: string): Promise<void> {
    const port = await startServer(this.containerName);
    const baseUrl = `http://localhost:${port}`;

    // Reset error state for new message
    this.streamError = null;

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      // If resuming an existing session, verify it still exists
      if (this.sessionId) {
        const sessionExists = await this.verifySession(port);
        if (!sessionExists) {
          console.log(`[opencode-server] Session ${this.sessionId} no longer exists, creating new one`);
          this.sessionId = undefined;
          this.onMessage({
            type: 'system',
            content: 'Previous session expired, starting new session...',
            timestamp: new Date().toISOString(),
          });
        } else {
          // Check if session is busy (another client using it)
          const status = await this.getSessionStatus(port);
          if (status?.type === 'busy') {
            this.onMessage({
              type: 'system',
              content: 'Session is currently busy, waiting for it to become available...',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      if (!this.sessionId) {
        const sessionPayload = this.model ? JSON.stringify({ model: this.model }) : '{}';
        const createResult = await execInContainer(
          this.containerName,
          [
            'curl',
            '-s',
            '--max-time',
            String(MESSAGE_SEND_TIMEOUT_MS / 1000),
            '-X',
            'POST',
            `${baseUrl}/session`,
            '-H',
            'Content-Type: application/json',
            '-d',
            sessionPayload,
          ],
          { user: 'workspace' }
        );

        if (createResult.exitCode !== 0) {
          throw new Error(`Failed to create session: ${createResult.stderr || 'Unknown error'}`);
        }

        try {
          const session = JSON.parse(createResult.stdout);
          this.sessionId = session.id;
        } catch {
          throw new Error(`Invalid response from OpenCode server: ${createResult.stdout}`);
        }

        this.sessionModel = this.model;
        this.onMessage({
          type: 'system',
          content: `Session started ${this.sessionId}`,
          timestamp: new Date().toISOString(),
        });
      }

      this.responseComplete = false;
      this.seenToolUse.clear();
      this.seenToolResult.clear();

      // Start SSE stream with timeout
      const { ready, done } = await this.startSSEStream(port);

      // Wait for SSE stream to be ready with timeout
      const readyTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout waiting for connection to OpenCode server')), SSE_READY_TIMEOUT_MS);
      });

      try {
        await Promise.race([ready, readyTimeout]);
      } catch (err) {
        this.cleanup();
        throw err;
      }

      // Now send the message - THIS IS AWAITED now!
      const messagePayload = JSON.stringify({
        parts: [{ type: 'text', text: userMessage }],
      });

      const sendResult = await execInContainer(
        this.containerName,
        [
          'curl',
          '-s',
          '--max-time',
          String(MESSAGE_SEND_TIMEOUT_MS / 1000),
          '-w',
          '\n%{http_code}',
          '-X',
          'POST',
          `${baseUrl}/session/${this.sessionId}/message`,
          '-H',
          'Content-Type: application/json',
          '-d',
          messagePayload,
        ],
        { user: 'workspace' }
      );

      // Parse the HTTP status code from the last line
      const lines = sendResult.stdout.trim().split('\n');
      const httpStatus = lines.pop();

      if (sendResult.exitCode !== 0) {
        this.cleanup();
        throw new Error(`Failed to send message: ${sendResult.stderr || 'Connection failed'}`);
      }

      if (httpStatus && !httpStatus.startsWith('2')) {
        this.cleanup();
        const errorBody = lines.join('\n');
        throw new Error(`OpenCode server error (HTTP ${httpStatus}): ${errorBody || 'Unknown error'}`);
      }

      // Wait for the response stream to complete
      await done;

      // Check if there was a stream error during processing
      if (this.streamError) {
        throw this.streamError;
      }

      this.onMessage({
        type: 'done',
        content: 'Response complete',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[opencode-server] Error:', err);
      this.cleanup();
      this.onMessage({
        type: 'error',
        content: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Clean up resources (timers, processes)
   */
  private cleanup(): void {
    this.stopHeartbeatMonitor();
    if (this.sseProcess) {
      this.sseProcess.kill();
      this.sseProcess = null;
    }
  }

  private async startSSEStream(
    port: number
  ): Promise<{ ready: Promise<void>; done: Promise<void> }> {
    let resolveReady: () => void;
    let rejectReady: (err: Error) => void;
    let resolveDone: () => void;
    let rejectDone: (err: Error) => void;
    let readyResolved = false;
    let doneResolved = false;

    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = () => {
        if (!readyResolved) {
          readyResolved = true;
          resolve();
        }
      };
      rejectReady = (err: Error) => {
        if (!readyResolved) {
          readyResolved = true;
          reject(err);
        }
      };
    });

    const done = new Promise<void>((resolve, reject) => {
      resolveDone = () => {
        if (!doneResolved) {
          doneResolved = true;
          this.stopHeartbeatMonitor();
          resolve();
        }
      };
      rejectDone = (err: Error) => {
        if (!doneResolved) {
          doneResolved = true;
          this.stopHeartbeatMonitor();
          reject(err);
        }
      };
    });

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
        String(SSE_STREAM_TIMEOUT_MS / 1000),
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
    let hasReceivedData = false;

    // Start heartbeat monitoring once we receive data
    const startHeartbeatMonitor = () => {
      this.lastHeartbeat = Date.now();
      this.heartbeatTimer = setInterval(() => {
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          console.error(`[opencode-server] No heartbeat received for ${timeSinceLastHeartbeat}ms, connection may be lost`);
          this.streamError = new Error('Connection to OpenCode server lost (no heartbeat)');
          this.onMessage({
            type: 'error',
            content: 'Connection to OpenCode server lost. Please try again.',
            timestamp: new Date().toISOString(),
          });
          proc.kill();
          resolveDone!();
        }
      }, HEARTBEAT_TIMEOUT_MS / 2);
    };

    const processChunk = (chunk: Uint8Array) => {
      buffer += decoder.decode(chunk);
      if (!hasReceivedData) {
        hasReceivedData = true;
        startHeartbeatMonitor();
        resolveReady!();
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event: OpenCodeServerEvent = JSON.parse(data);

          // Update heartbeat timestamp for any valid event (including heartbeats)
          this.lastHeartbeat = Date.now();

          // Handle heartbeat events silently
          if (event.type === 'server.heartbeat' || event.type === 'server.connected') {
            continue;
          }

          this.handleEvent(event);

          if (event.type === 'session.idle') {
            this.responseComplete = true;
            proc.kill();
            resolveDone!();
            return;
          }
        } catch {
          continue;
        }
      }
    };

    // Process stdout stream
    (async () => {
      if (!proc.stdout) {
        rejectReady!(new Error('Failed to start SSE stream: no stdout'));
        rejectDone!(new Error('Failed to start SSE stream: no stdout'));
        return;
      }

      try {
        for await (const chunk of proc.stdout) {
          processChunk(chunk);
          if (this.responseComplete) break;
        }

        // Stream ended - check if it was expected
        if (!this.responseComplete && !doneResolved) {
          // Stream ended without session.idle - could be connection loss
          console.warn('[opencode-server] SSE stream ended unexpectedly');
          this.streamError = new Error('Connection to OpenCode server closed unexpectedly');
        }
      } catch (err) {
        console.error('[opencode-server] SSE stream error:', err);
        this.streamError = err as Error;
      }

      resolveDone!();
    })();

    // Capture stderr for diagnostics
    (async () => {
      if (!proc.stderr) return;
      const stderrDecoder = new TextDecoder();
      let stderr = '';
      for await (const chunk of proc.stderr) {
        stderr += stderrDecoder.decode(chunk);
      }
      if (stderr && !this.responseComplete) {
        console.error('[opencode-server] SSE stderr:', stderr);
      }
    })();

    // Timeout for initial ready state
    setTimeout(() => {
      if (!hasReceivedData && !readyResolved) {
        rejectReady!(new Error('Timeout connecting to OpenCode server event stream'));
      }
    }, SSE_READY_TIMEOUT_MS);

    // Overall stream timeout with user-visible error
    setTimeout(() => {
      if (!this.responseComplete && !doneResolved) {
        console.warn(`[opencode-server] SSE stream timeout after ${SSE_STREAM_TIMEOUT_MS}ms`);
        this.streamError = new Error('Request timed out. The operation took too long to complete.');
        this.onMessage({
          type: 'error',
          content: 'Request timed out. Please try again or check if OpenCode is responding.',
          timestamp: new Date().toISOString(),
        });
        proc.kill();
        resolveDone!();
      }
    }, SSE_STREAM_TIMEOUT_MS);

    return { ready, done };
  }

  /**
   * Stop the heartbeat monitor timer
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
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
      } else if (part.type === 'tool' && part.tool) {
        const state = part.state;
        const partId = part.id;

        if (!this.seenToolUse.has(partId)) {
          this.seenToolUse.add(partId);
          this.onMessage({
            type: 'tool_use',
            content: JSON.stringify(state?.input, null, 2),
            toolName: state?.title || part.tool,
            toolId: partId,
            timestamp,
          });
        }

        if (state?.status === 'completed' && state?.output && !this.seenToolResult.has(partId)) {
          this.seenToolResult.add(partId);
          this.onMessage({
            type: 'tool_result',
            content: state.output,
            toolId: partId,
            timestamp,
          });
        }
      }
    }
  }

  async interrupt(): Promise<void> {
    if (this.sseProcess || this.heartbeatTimer) {
      this.cleanup();
      this.onMessage({
        type: 'system',
        content: 'Chat interrupted',
        timestamp: new Date().toISOString(),
      });
    }
  }

  setModel(model: string): void {
    if (this.model !== model) {
      this.model = model;
      if (this.sessionModel !== model) {
        this.sessionId = undefined;
        this.onMessage({
          type: 'system',
          content: `Switching to model: ${model}`,
          timestamp: new Date().toISOString(),
        });
      }
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
