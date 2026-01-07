import type { ChatProcess, OpencodeStreamEvent, MessageCallback, SpawnConfig } from './types';

export abstract class BaseOpencodeSession {
  protected process: ChatProcess | null = null;
  protected sessionId?: string;
  protected model?: string;
  protected sessionModel?: string;
  protected onMessage: MessageCallback;
  protected buffer: string = '';
  protected historyLoaded: boolean = false;

  constructor(
    sessionId: string | undefined,
    model: string | undefined,
    onMessage: MessageCallback
  ) {
    this.sessionId = sessionId;
    this.model = model;
    this.sessionModel = model;
    this.onMessage = onMessage;
  }

  protected abstract getSpawnConfig(userMessage: string): SpawnConfig;
  protected abstract getLogPrefix(): string;
  protected abstract getNoOutputErrorMessage(): string;

  abstract loadHistory(): Promise<void>;

  async sendMessage(userMessage: string): Promise<void> {
    if (this.sessionId && !this.historyLoaded) {
      await this.loadHistory();
    }

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
          content: stderrText || `OpenCode exited with code ${exitCode}`,
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

  protected processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event: OpencodeStreamEvent = JSON.parse(line);
        this.handleStreamEvent(event);
      } catch {
        console.error(`[${this.getLogPrefix()}] Failed to parse:`, line);
      }
    }
  }

  protected handleStreamEvent(event: OpencodeStreamEvent): void {
    const timestamp = new Date().toISOString();

    if (event.type === 'step_start' && event.sessionID) {
      if (!this.sessionId) {
        this.sessionId = event.sessionID;
        this.sessionModel = this.model;
        this.historyLoaded = true;
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

      console.log(`[${this.getLogPrefix()}] Tool use:`, toolName, title);

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

  setModel(model: string): void {
    if (this.model !== model) {
      this.model = model;
      if (this.sessionModel !== model) {
        this.sessionId = undefined;
        this.historyLoaded = false;
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
