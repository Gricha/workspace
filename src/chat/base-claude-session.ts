import type { ChatProcess, ClaudeStreamMessage, MessageCallback, SpawnConfig } from './types';
import { DEFAULT_CLAUDE_MODEL } from '../shared/constants';

export abstract class BaseClaudeSession {
  protected process: ChatProcess | null = null;
  protected sessionId?: string;
  protected model: string;
  protected sessionModel: string;
  protected onMessage: MessageCallback;
  protected buffer: string = '';

  constructor(
    sessionId: string | undefined,
    model: string | undefined,
    onMessage: MessageCallback
  ) {
    this.sessionId = sessionId;
    this.model = model || DEFAULT_CLAUDE_MODEL;
    this.sessionModel = this.model;
    this.onMessage = onMessage;
  }

  protected abstract getSpawnConfig(userMessage: string): SpawnConfig;
  protected abstract getLogPrefix(): string;

  async sendMessage(userMessage: string): Promise<void> {
    const logPrefix = this.getLogPrefix();
    const { command, options } = this.getSpawnConfig(userMessage);

    console.log(`[${logPrefix}] Running:`, command.join(' '));

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      const proc = Bun.spawn(command, {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        ...options,
      });

      this.process = proc;

      if (!proc.stdout || !proc.stderr) {
        throw new Error('Failed to get process streams');
      }

      console.log(`[${logPrefix}] Process spawned, waiting for output...`);

      const stderrPromise = new Response(proc.stderr).text();

      const decoder = new TextDecoder();
      let receivedAnyOutput = false;

      for await (const chunk of proc.stdout) {
        const text = decoder.decode(chunk);
        console.log(`[${logPrefix}] Received chunk:`, text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();
      }

      const exitCode = await proc.exited;
      console.log(
        `[${logPrefix}] Process exited with code:`,
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error(`[${logPrefix}] stderr:`, stderrText);
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
          content: this.getNoOutputErrorMessage(),
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
      console.error(`[${logPrefix}] Error:`, err);
      this.onMessage({
        type: 'error',
        content: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.process = null;
    }
  }

  protected getNoOutputErrorMessage(): string {
    return 'No response from Claude. Check if Claude is authenticated.';
  }

  protected processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg: ClaudeStreamMessage = JSON.parse(line);
        this.handleStreamMessage(msg);
      } catch {
        console.error(`[${this.getLogPrefix()}] Failed to parse:`, line);
      }
    }
  }

  protected handleStreamMessage(msg: ClaudeStreamMessage): void {
    const timestamp = new Date().toISOString();

    if (msg.type === 'system' && msg.subtype === 'init') {
      this.sessionId = msg.session_id;
      this.sessionModel = this.model;
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
