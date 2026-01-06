import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';
import { opencodeProvider } from '../sessions/agents/opencode';
import type { ExecInContainer } from '../sessions/agents/types';

export interface OpencodeOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
  model?: string;
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

export class OpencodeSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private containerName: string;
  private workDir: string;
  private sessionId?: string;
  private model?: string;
  private sessionModel?: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';
  private historyLoaded: boolean = false;

  constructor(options: OpencodeOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/home/workspace';
    this.sessionId = options.sessionId;
    this.model = options.model;
    this.sessionModel = options.model;
    this.onMessage = onMessage;
  }

  async loadHistory(): Promise<void> {
    if (this.historyLoaded || !this.sessionId) {
      return;
    }

    this.historyLoaded = true;

    const exec: ExecInContainer = async (containerName, command, options) => {
      const args = ['exec'];
      if (options?.user) {
        args.push('-u', options.user);
      }
      args.push(containerName, ...command);

      const proc = Bun.spawn(['docker', ...args], {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      return { stdout, stderr, exitCode };
    };

    try {
      const result = await opencodeProvider.getSessionMessages(
        this.containerName,
        this.sessionId,
        exec
      );

      if (result && result.messages.length > 0) {
        this.onMessage({
          type: 'system',
          content: `Loading ${result.messages.length} messages from session history...`,
          timestamp: new Date().toISOString(),
        });

        for (const msg of result.messages) {
          this.onMessage({
            type: msg.type as ChatMessage['type'],
            content: msg.content || '',
            toolName: msg.toolName,
            toolId: msg.toolId,
            timestamp: msg.timestamp || new Date().toISOString(),
          });
        }

        this.onMessage({
          type: 'system',
          content: 'Session history loaded',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[opencode] Failed to load history:', err);
    }
  }

  async sendMessage(userMessage: string): Promise<void> {
    if (this.sessionId && !this.historyLoaded) {
      await this.loadHistory();
    }

    const args = [
      'exec',
      '-i',
      '-u',
      'workspace',
      '-w',
      this.workDir,
      this.containerName,
      'stdbuf',
      '-oL',
      'opencode',
      'run',
      '--format',
      'json',
    ];

    if (this.sessionId) {
      args.push('--session', this.sessionId);
    }

    if (this.model) {
      args.push('--model', this.model);
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

      console.log('[opencode] Tool use:', toolName, title);

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

export function createOpencodeSession(
  options: OpencodeOptions,
  onMessage: (message: ChatMessage) => void
): OpencodeSession {
  return new OpencodeSession(options, onMessage);
}
