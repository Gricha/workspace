import type { ChatProcess, ClaudeStreamMessage, MessageCallback, SpawnConfig } from './types';
import { DEFAULT_CLAUDE_MODEL } from '../shared/constants';
import { SessionMonitor, MONITOR_PRESETS, formatErrorMessage } from './session-monitor';

export abstract class BaseClaudeSession {
  protected process: ChatProcess | null = null;
  protected sessionId?: string;
  protected model: string;
  protected sessionModel: string;
  protected onMessage: MessageCallback;
  protected buffer: string = '';
  private monitor: SessionMonitor | null = null;

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

    // Create monitor with activity tracking to detect frozen subprocesses
    this.monitor = new SessionMonitor(
      {
        ...MONITOR_PRESETS.claudeCode,
        activityTimeout: 60000, // Detect if no output for 60s
      },
      {
        onError: this.onMessage,
        onTimeout: () => {
          if (this.process) {
            console.warn(`[${logPrefix}] Killing process due to timeout`);
            this.process.kill();
          }
        },
        onActivityTimeout: () => {
          if (this.process) {
            console.warn(`[${logPrefix}] Killing process due to inactivity`);
            this.process.kill();
          }
        },
      }
    );

    this.monitor.start();

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
        // Mark activity so monitor knows subprocess is alive
        if (this.monitor) {
          this.monitor.markActivity();
        }

        const text = decoder.decode(chunk);
        console.log(`[${logPrefix}] Received chunk:`, text.length, 'bytes');
        receivedAnyOutput = true;
        this.buffer += text;
        this.processBuffer();

        // Check if monitor has timed out
        if (this.monitor?.isCompleted()) {
          console.warn(`[${logPrefix}] Monitor timeout, breaking from output loop`);
          proc.kill();
          break;
        }
      }

      const exitCode = await proc.exited;
      console.log(
        `[${logPrefix}] Process exited with code:`,
        exitCode,
        'receivedOutput:',
        receivedAnyOutput
      );

      // Stop monitoring before handling results
      if (this.monitor && !this.monitor.isCompleted()) {
        this.monitor.complete();
      }

      const stderrText = await stderrPromise;
      if (stderrText) {
        console.error(`[${logPrefix}] stderr:`, stderrText);
      }

      // Don't send error if monitor already sent one
      if (this.monitor?.isCompleted()) {
        return;
      }

      if (exitCode !== 0) {
        this.onMessage({
          type: 'error',
          content: formatErrorMessage(
            new Error(stderrText || `Claude exited with code ${exitCode}`),
            'Claude Code'
          ),
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
        content: formatErrorMessage(err, 'Claude Code'),
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (this.monitor) {
        this.monitor.complete();
      }
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
    if (this.monitor) {
      this.monitor.complete();
    }
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
