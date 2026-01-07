import { homedir } from 'os';
import { BaseClaudeSession } from './base-claude-session';
import type { ChatMessage, MessageCallback, SpawnConfig, HostChatOptions } from './types';

export type { HostChatOptions };

export class HostChatSession extends BaseClaudeSession {
  private workDir: string;

  constructor(options: HostChatOptions, onMessage: MessageCallback) {
    super(options.sessionId, options.model, onMessage);
    this.workDir = options.workDir || homedir();
  }

  protected getLogPrefix(): string {
    return 'host-chat';
  }

  protected getSpawnConfig(userMessage: string): SpawnConfig {
    const args = [
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
}

export function createHostChatSession(
  options: HostChatOptions,
  onMessage: (message: ChatMessage) => void
): HostChatSession {
  return new HostChatSession(options, onMessage);
}
