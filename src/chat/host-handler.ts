import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';
import { homedir } from 'os';

export interface HostChatOptions {
  workDir?: string;
  sessionId?: string;
  model?: string;
}

interface StreamMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: unknown;
    }>;
  };
  event?: {
    type: string;
    delta?: {
      type: string;
      text?: string;
    };
  };
  result?: string;
}

export class HostChatSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private workDir: string;
  private sessionId?: string;
  private model: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';

  constructor(options: HostChatOptions, onMessage: (message: ChatMessage) => void) {
    this.workDir = options.workDir || homedir();
    this.sessionId = options.sessionId;
    this.model = options.model || 'sonnet';
    this.onMessage = onMessage;
  }

  async sendMessage(userMessage: string): Promise<void> {
    const args = [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--model',
      this.model,
      '--dangerously-skip-permissions',
    ];

    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    args.push(userMessage);

    console.log('[host-chat] Running: claude', args.join(' '));

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      const proc = Bun.spawn(['claude', ...args], {
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

      console.log('[host-chat] Process spawned, waiting for output...');

      const stderrPromise = new Response(proc.stderr).text();

      const decoder = new TextDecoder();
      let receivedAnyOutput = false;

      for await (const chunk of proc.stdout) {
        const text = decoder.decode(chunk);
        console.log('[host-chat] Received chunk:', text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();
      }

      const exitCode = await proc.exited;
      console.log(
        '[host-chat] Process exited with code:',
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error('[host-chat] stderr:', stderrText);
      }

      if (exitCode !== 0) {
        this.onMessage({
          type: 'error',
          content: stderrText || `Claude exited with code ${exitCode}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!receivedAnyOutput) {
        this.onMessage({
          type: 'error',
          content: 'No response from Claude. Check if Claude is authenticated.',
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
      console.error('[host-chat] Error:', err);
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
        const msg: StreamMessage = JSON.parse(line);
        this.handleStreamMessage(msg);
      } catch {
        console.error('[host-chat] Failed to parse:', line);
      }
    }
  }

  private handleStreamMessage(msg: StreamMessage): void {
    const timestamp = new Date().toISOString();

    if (msg.type === 'system' && msg.subtype === 'init') {
      this.sessionId = msg.session_id;
      this.onMessage({
        type: 'system',
        content: `Session started: ${msg.session_id?.slice(0, 8)}...`,
        timestamp,
      });
      return;
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          this.onMessage({
            type: 'tool_use',
            content: JSON.stringify(block.input, null, 2),
            toolName: block.name,
            toolId: block.id,
            timestamp,
          });
        }
      }
      return;
    }

    if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta') {
      const delta = msg.event?.delta;
      if (delta?.type === 'text_delta' && delta?.text) {
        this.onMessage({
          type: 'assistant',
          content: delta.text,
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

export function createHostChatSession(
  options: HostChatOptions,
  onMessage: (message: ChatMessage) => void
): HostChatSession {
  return new HostChatSession(options, onMessage);
}
