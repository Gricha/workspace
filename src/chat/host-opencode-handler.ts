import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';
import { homedir } from 'os';

export interface HostOpencodeOptions {
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
    tool?: string;
    callID?: string;
    state?: {
      status?: string;
      input?: Record<string, unknown>;
      output?: string;
      title?: string;
    };
    reason?: string;
  };
}

export class HostOpencodeSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private workDir: string;
  private sessionId?: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';

  constructor(options: HostOpencodeOptions, onMessage: (message: ChatMessage) => void) {
    this.workDir = options.workDir || homedir();
    this.sessionId = options.sessionId;
    this.onMessage = onMessage;
  }

  async sendMessage(userMessage: string): Promise<void> {
    const args = ['run', '--format', 'json'];

    if (this.sessionId) {
      args.push('--session', this.sessionId);
    }

    args.push(userMessage);

    console.log('[host-opencode] Running: opencode', args.join(' '));

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      const proc = Bun.spawn(['opencode', ...args], {
        cwd: this.workDir,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
        },
      });

      this.process = proc;

      if (!proc.stdout || !proc.stderr) {
        throw new Error('Failed to get process streams');
      }

      console.log('[host-opencode] Process spawned, waiting for output...');

      const stderrPromise = new Response(proc.stderr).text();

      const decoder = new TextDecoder();
      let receivedAnyOutput = false;

      for await (const chunk of proc.stdout) {
        const text = decoder.decode(chunk);
        console.log('[host-opencode] Received chunk:', text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();
      }

      const exitCode = await proc.exited;
      console.log(
        '[host-opencode] Process exited with code:',
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error('[host-opencode] stderr:', stderrText);
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
          content: 'No response from OpenCode. Check if OpenCode is installed and configured.',
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
      console.error('[host-opencode] Error:', err);
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
        console.error('[host-opencode] Failed to parse:', line);
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
          content: `Session started ${this.sessionId}`,
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

    if (event.type === 'tool_use' && event.part) {
      const toolName = event.part.tool || 'unknown';
      const toolId = event.part.callID || event.part.id;
      const input = event.part.state?.input;
      const output = event.part.state?.output;
      const title =
        event.part.state?.title || (input as { description?: string })?.description || toolName;

      console.log('[host-opencode] Tool use:', toolName, title);

      this.onMessage({
        type: 'tool_use',
        content: JSON.stringify(input, null, 2),
        toolName: title || toolName,
        toolId,
        timestamp,
      });

      if (output) {
        this.onMessage({
          type: 'tool_result',
          content: output,
          toolName,
          toolId,
          timestamp,
        });
      }
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

export function createHostOpencodeSession(
  options: HostOpencodeOptions,
  onMessage: (message: ChatMessage) => void
): HostOpencodeSession {
  return new HostOpencodeSession(options, onMessage);
}
