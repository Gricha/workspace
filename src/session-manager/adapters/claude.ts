import type { Subprocess, Terminal } from 'bun';
import type { AgentAdapter, AdapterStartOptions, SessionStatus } from '../types';
import type { ChatMessage, ClaudeStreamMessage } from '../../chat/types';
import { DEFAULT_CLAUDE_MODEL } from '../../shared/constants';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (status: SessionStatus) => void;
type ErrorCallback = (error: Error) => void;

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly agentType = 'claude' as const;

  private process: Subprocess<'ignore', 'ignore', 'ignore'> | null = null;
  private terminal: Terminal | null = null;
  private status: SessionStatus = 'idle';
  private agentSessionId?: string;
  private model: string = DEFAULT_CLAUDE_MODEL;
  private containerName?: string;
  private isHost = false;
  private workDir = '/home/workspace';

  private buffer = '';
  private messageCallback?: MessageCallback;
  private statusCallback?: StatusCallback;
  private errorCallback?: ErrorCallback;

  private pendingMessage: string | null = null;
  private messageResolver: (() => void) | null = null;
  private currentMessageId?: string;

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
    this.containerName = options.containerName;
    this.isHost = options.isHost;
    this.agentSessionId = options.agentSessionId;
    if (options.model) {
      this.model = options.model;
    }

    this.setStatus('idle');
  }

  async sendMessage(message: string): Promise<void> {
    if (this.status === 'running') {
      const err = new Error('Session is already processing a message');
      this.emitError(err);
      throw err;
    }

    this.pendingMessage = message;
    this.setStatus('running');

    return new Promise((resolve, reject) => {
      this.messageResolver = resolve;

      try {
        this.spawnClaudeProcess(message);
      } catch (err) {
        this.setStatus('error');
        this.emitError(err as Error);
        this.messageResolver = null;
        reject(err);
      }
    });
  }

  private spawnClaudeProcess(userMessage: string): void {
    const command = this.buildCommand(userMessage);

    this.emitMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    if (this.isHost) {
      this.process = Bun.spawn(command, {
        terminal: {
          cols: 200,
          rows: 50,
          data: (_terminal: Terminal, chunk: Uint8Array) => {
            this.handleOutput(Buffer.from(chunk).toString());
          },
        },
      });
    } else {
      this.process = Bun.spawn(command, {
        terminal: {
          cols: 200,
          rows: 50,
          data: (_terminal: Terminal, chunk: Uint8Array) => {
            this.handleOutput(Buffer.from(chunk).toString());
          },
        },
      });
    }

    this.terminal = this.process.terminal!;

    this.process.exited.then((code) => {
      this.handleProcessExit(code);
    });
  }

  private buildCommand(userMessage: string): string[] {
    const claudeArgs = [
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

    if (this.agentSessionId) {
      claudeArgs.push('--resume', this.agentSessionId);
    }

    claudeArgs.push(userMessage);

    if (this.isHost) {
      return claudeArgs;
    }

    return [
      'docker',
      'exec',
      '-it',
      '-u',
      'workspace',
      '-w',
      this.workDir,
      this.containerName!,
      ...claudeArgs,
    ];
  }

  private handleOutput(data: string): void {
    this.buffer += data;
    this.processBuffer();
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg: ClaudeStreamMessage = JSON.parse(line);
        this.handleStreamMessage(msg);
      } catch {
        // Not valid JSON, might be terminal escape sequences or other output
      }
    }
  }

  private handleStreamMessage(msg: ClaudeStreamMessage): void {
    const timestamp = new Date().toISOString();

    if (msg.type === 'system' && msg.subtype === 'init') {
      this.agentSessionId = msg.session_id;
      // Trigger status callback so manager can update session.info.agentSessionId
      if (this.statusCallback) {
        this.statusCallback(this.status);
      }
      this.emitMessage({
        type: 'system',
        content: `Session started: ${msg.session_id?.slice(0, 8)}...`,
        timestamp,
      });
      return;
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      // Capture message ID from upstream when assistant message starts
      const messageId = msg.message.id || msg.id;
      if (messageId) {
        this.currentMessageId = messageId;
      }

      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          this.emitMessage({
            type: 'tool_use',
            content: JSON.stringify(block.input, null, 2),
            toolName: block.name,
            toolId: block.id,
            messageId: this.currentMessageId,
            timestamp,
          });
        }
      }
      return;
    }

    if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta') {
      const delta = msg.event?.delta;
      if (delta?.type === 'text_delta' && delta?.text) {
        this.emitMessage({
          type: 'assistant',
          content: delta.text,
          messageId: this.currentMessageId,
          timestamp,
        });
      }
      return;
    }

    if (msg.type === 'result') {
      this.emitMessage({
        type: 'done',
        content: 'Response complete',
        messageId: this.currentMessageId,
        timestamp,
      });
      this.currentMessageId = undefined;
    }
  }

  private handleProcessExit(code: number | null): void {
    this.process = null;
    this.terminal = null;
    this.currentMessageId = undefined;

    if (this.status === 'interrupted') {
      this.emitMessage({
        type: 'system',
        content: 'Session interrupted',
        timestamp: new Date().toISOString(),
      });
    } else if (code !== 0 && code !== null) {
      const err = new Error(`Claude exited with code ${code}`);
      this.setStatus('error');
      this.emitError(err);
      this.emitMessage({
        type: 'error',
        content: err.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.setStatus('idle');
      this.emitMessage({
        type: 'done',
        content: 'Response complete',
        timestamp: new Date().toISOString(),
      });
    }

    if (this.messageResolver) {
      this.messageResolver();
      this.messageResolver = null;
    }
    this.pendingMessage = null;
  }

  async interrupt(): Promise<void> {
    if (this.process) {
      this.setStatus('interrupted');
      this.process.kill();
      this.process = null;
      this.terminal = null;
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
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  private emitMessage(message: ChatMessage): void {
    if (this.messageCallback) {
      this.messageCallback(message);
    }
  }

  private emitError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}
