import { homedir } from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseOpencodeSession } from './base-opencode-session';
import type { ChatMessage, MessageCallback, SpawnConfig, HostChatOptions } from './types';

export type { HostChatOptions as HostOpencodeOptions };

export class HostOpencodeSession extends BaseOpencodeSession {
  private workDir: string;

  constructor(options: HostChatOptions, onMessage: MessageCallback) {
    super(options.sessionId, options.model, onMessage);
    this.workDir = options.workDir || homedir();
  }

  protected getLogPrefix(): string {
    return 'host-opencode';
  }

  protected getNoOutputErrorMessage(): string {
    return 'No response from OpenCode. Check if OpenCode is installed and configured.';
  }

  protected getSpawnConfig(userMessage: string): SpawnConfig {
    const args = ['stdbuf', '-oL', 'opencode', 'run', '--format', 'json'];

    if (this.sessionId) {
      args.push('--session', this.sessionId);
    }

    if (this.model) {
      args.push('--model', this.model);
    }

    args.push(userMessage);

    return {
      command: args,
      options: {
        cwd: this.workDir,
        env: {
          ...process.env,
        },
      },
    };
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
}

export function createHostOpencodeSession(
  options: HostChatOptions,
  onMessage: (message: ChatMessage) => void
): HostOpencodeSession {
  return new HostOpencodeSession(options, onMessage);
}
