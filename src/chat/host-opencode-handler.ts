import type { Subprocess } from 'bun';
import type { ChatMessage } from './handler';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import path from 'path';

export interface HostOpencodeOptions {
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

export class HostOpencodeSession {
  private process: Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  private workDir: string;
  private sessionId?: string;
  private model?: string;
  private sessionModel?: string;
  private onMessage: (message: ChatMessage) => void;
  private buffer: string = '';
  private historyLoaded: boolean = false;

  constructor(options: HostOpencodeOptions, onMessage: (message: ChatMessage) => void) {
    this.workDir = options.workDir || homedir();
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

    try {
      const homeDir = homedir();
      const sessionDir = path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'session');
      const sessionFile = path.join(sessionDir, `${this.sessionId}.json`);

      let internalId: string;
      try {
        const sessionContent = await fs.readFile(sessionFile, 'utf-8');
        const session = JSON.parse(sessionContent) as { id: string };
        internalId = session.id;
      } catch {
        return;
      }

      const msgDir = path.join(
        homeDir,
        '.local',
        'share',
        'opencode',
        'storage',
        'message',
        internalId
      );
      const partDir = path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'part');

      let msgFiles: string[];
      try {
        const files = await fs.readdir(msgDir);
        msgFiles = files.filter((f) => f.startsWith('msg_') && f.endsWith('.json')).sort();
      } catch {
        return;
      }

      const messages: ChatMessage[] = [];

      for (const msgFile of msgFiles) {
        try {
          const msgContent = await fs.readFile(path.join(msgDir, msgFile), 'utf-8');
          const msg = JSON.parse(msgContent) as {
            id?: string;
            role?: 'user' | 'assistant';
            time?: { created?: number };
          };

          if (!msg.id || (msg.role !== 'user' && msg.role !== 'assistant')) continue;

          const timestamp = msg.time?.created
            ? new Date(msg.time.created).toISOString()
            : new Date().toISOString();

          const partMsgDir = path.join(partDir, msg.id);
          let partFiles: string[];
          try {
            const files = await fs.readdir(partMsgDir);
            partFiles = files.filter((f) => f.startsWith('prt_') && f.endsWith('.json')).sort();
          } catch {
            continue;
          }

          for (const partFile of partFiles) {
            try {
              const partContent = await fs.readFile(path.join(partMsgDir, partFile), 'utf-8');
              const part = JSON.parse(partContent) as {
                type: string;
                text?: string;
                tool?: string;
                callID?: string;
                id?: string;
                state?: {
                  input?: Record<string, unknown>;
                  output?: string;
                  title?: string;
                };
              };

              if (part.type === 'text' && part.text) {
                messages.push({
                  type: msg.role as 'user' | 'assistant',
                  content: part.text,
                  timestamp,
                });
              } else if (part.type === 'tool' && part.tool) {
                messages.push({
                  type: 'tool_use',
                  content: JSON.stringify(part.state?.input, null, 2),
                  toolName: part.state?.title || part.tool,
                  toolId: part.callID || part.id,
                  timestamp,
                });
                if (part.state?.output) {
                  messages.push({
                    type: 'tool_result',
                    content: part.state.output,
                    toolId: part.callID || part.id,
                    timestamp,
                  });
                }
              }
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      if (messages.length > 0) {
        this.onMessage({
          type: 'system',
          content: `Loading ${messages.length} messages from session history...`,
          timestamp: new Date().toISOString(),
        });

        for (const msg of messages) {
          this.onMessage(msg);
        }

        this.onMessage({
          type: 'system',
          content: 'Session history loaded',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[host-opencode] Failed to load history:', err);
    }
  }

  async sendMessage(userMessage: string): Promise<void> {
    if (this.sessionId && !this.historyLoaded) {
      await this.loadHistory();
    }

    const args = ['-oL', 'opencode', 'run', '--format', 'json'];

    if (this.sessionId) {
      args.push('--session', this.sessionId);
    }

    if (this.model) {
      args.push('--model', this.model);
    }

    args.push(userMessage);

    console.log('[host-opencode] Running: stdbuf', args.join(' '));

    this.onMessage({
      type: 'system',
      content: 'Processing your message...',
      timestamp: new Date().toISOString(),
    });

    try {
      const proc = Bun.spawn(['stdbuf', ...args], {
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

export function createHostOpencodeSession(
  options: HostOpencodeOptions,
  onMessage: (message: ChatMessage) => void
): HostOpencodeSession {
  return new HostOpencodeSession(options, onMessage);
}
