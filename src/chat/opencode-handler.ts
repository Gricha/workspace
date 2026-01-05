import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';

export interface OpencodeOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
}

interface OpencodeStreamEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    id?: string;
    sessionID?: string;
    messageID?: string;
    type: string;
    text?: string;
    name?: string;
    input?: unknown;
    output?: string;
    reason?: string;
  };
}

export class OpencodeSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private containerName: string;
  private workDir: string;
  private sessionId?: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';

  constructor(options: OpencodeOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/workspace';
    this.sessionId = options.sessionId;
    this.onMessage = onMessage;
  }

  async sendMessage(userMessage: string): Promise<void> {
    const args = [
      'exec',
      '-u',
      'workspace',
      '-w',
      this.workDir,
      this.containerName,
      'opencode',
      'run',
      '--format',
      'json',
    ];

    if (this.sessionId) {
      args.push('--session', this.sessionId);
    }

    args.push(userMessage);

    console.log('[opencode] Running:', 'docker', args.join(' '));

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      const proc = Bun.spawn(['docker', ...args], {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      this.process = proc;

      if (!proc.stdout || !proc.stderr) {
        throw new Error('Failed to get process streams');
      }

      console.log('[opencode] Process spawned, waiting for output...');

      const stderrPromise = new Response(proc.stderr).text();

      const decoder = new TextDecoder();
      let receivedAnyOutput = false;

      for await (const chunk of proc.stdout) {
        const text = decoder.decode(chunk);
        console.log('[opencode] Received chunk:', text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();
      }

      const exitCode = await proc.exited;
      console.log(
        '[opencode] Process exited with code:',
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error('[opencode] stderr:', stderrText);
      }

      if (exitCode !== 0) {
        this.onMessage({
          type: 'error',
          content: stderrText || `OpenCode exited with code ${exitCode}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!receivedAnyOutput) {
        this.onMessage({
          type: 'error',
          content: 'No response from OpenCode. Check if OpenCode is configured in the workspace.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.onMessage({
        type: 'done',
        content: 'Response complete',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[opencode] Error:', err);
      this.onMessage({
        type: 'error',
        content: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.process = null;
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event: OpencodeStreamEvent = JSON.parse(line);
        this.handleStreamEvent(event);
      } catch {
        console.error('[opencode] Failed to parse:', line);
      }
    }
  }

  private handleStreamEvent(event: OpencodeStreamEvent): void {
    const timestamp = new Date().toISOString();

    if (event.type === 'step_start' && event.sessionID) {
      if (!this.sessionId) {
        this.sessionId = event.sessionID;
        this.onMessage({
          type: 'system',
          content: `Session: ${this.sessionId.slice(0, 8)}...`,
          timestamp,
        });
      }
      return;
    }

    if (event.type === 'text' && event.part?.text) {
      this.onMessage({
        type: 'assistant',
        content: event.part.text,
        timestamp,
      });
      return;
    }

    if (event.type === 'tool_call' && event.part) {
      this.onMessage({
        type: 'tool_use',
        content: JSON.stringify(event.part.input, null, 2),
        toolName: event.part.name || 'unknown',
        toolId: event.part.id,
        timestamp,
      });
      return;
    }

    if (event.type === 'tool_result' && event.part) {
      this.onMessage({
        type: 'tool_result',
        content:
          typeof event.part.output === 'string'
            ? event.part.output
            : JSON.stringify(event.part.output),
        toolName: event.part.name || 'unknown',
        toolId: event.part.id,
        timestamp,
      });
      return;
    }
  }

  async interrupt(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
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

export function createOpencodeSession(
  options: OpencodeOptions,
  onMessage: (message: ChatMessage) => void
): OpencodeSession {
  return new OpencodeSession(options, onMessage);
}
