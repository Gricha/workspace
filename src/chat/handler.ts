import type { Subprocess } from 'bun';

export interface ChatOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
  model?: string;
}

export interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content: string;
  timestamp: string;
  toolName?: string;
  toolId?: string;
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

export class ChatSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private containerName: string;
  private workDir: string;
  private sessionId?: string;
  private model: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';

  constructor(options: ChatOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/workspace';
    this.sessionId = options.sessionId;
    this.model = options.model || 'sonnet';
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
      'claude',
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

    console.log('[chat] Running:', 'docker', args.join(' '));

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

      console.log('[chat] Process spawned, waiting for output...');

      const stderrPromise = new Response(proc.stderr).text();

      const decoder = new TextDecoder();
      let receivedAnyOutput = false;

      for await (const chunk of proc.stdout) {
        const text = decoder.decode(chunk);
        console.log('[chat] Received chunk:', text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();
      }

      const exitCode = await proc.exited;
      console.log(
        '[chat] Process exited with code:',
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error('[chat] stderr:', stderrText);
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
          content: 'No response from Claude. Check if Claude is authenticated in the workspace.',
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
      console.error('[chat] Error:', err);
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
        console.error('[chat] Failed to parse:', line);
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

export function createChatSession(
  options: ChatOptions,
  onMessage: (message: ChatMessage) => void
): ChatSession {
  return new ChatSession(options, onMessage);
}
