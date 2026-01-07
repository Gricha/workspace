import { BaseClaudeSession } from './base-claude-session';
import type { ChatMessage, MessageCallback, SpawnConfig, ContainerChatOptions } from './types';

export type { ChatMessage };

export interface ChatOptions extends ContainerChatOptions {}

export class ChatSession extends BaseClaudeSession {
  private containerName: string;
  private workDir: string;

  constructor(options: ChatOptions, onMessage: MessageCallback) {
    super(options.sessionId, options.model, onMessage);
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/home/workspace';
  }

  protected getLogPrefix(): string {
    return 'chat';
  }

  protected getSpawnConfig(userMessage: string): SpawnConfig {
    const args = [
      'docker',
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

    return {
      command: args,
      options: {},
    };
  }

  protected override getNoOutputErrorMessage(): string {
    return 'No response from Claude. Check if Claude is authenticated in the workspace.';
  }
}

export function createChatSession(
  options: ChatOptions,
  onMessage: (message: ChatMessage) => void
): ChatSession {
  return new ChatSession(options, onMessage);
}
