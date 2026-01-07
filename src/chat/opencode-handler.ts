import { BaseOpencodeSession } from './base-opencode-session';
import type { ChatMessage, MessageCallback, SpawnConfig, ContainerChatOptions } from './types';
import { opencodeProvider } from '../sessions/agents/opencode';
import type { ExecInContainer } from '../sessions/agents/types';

export interface OpencodeOptions extends ContainerChatOptions {}

export class OpencodeSession extends BaseOpencodeSession {
  private containerName: string;
  private workDir: string;

  constructor(options: OpencodeOptions, onMessage: MessageCallback) {
    super(options.sessionId, options.model, onMessage);
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/home/workspace';
  }

  protected getLogPrefix(): string {
    return 'opencode';
  }

  protected getNoOutputErrorMessage(): string {
    return 'No response from OpenCode. Check if OpenCode is configured in the workspace.';
  }

  protected getSpawnConfig(userMessage: string): SpawnConfig {
    const args = [
      'docker',
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

    return {
      command: args,
      options: {},
    };
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
}

export function createOpencodeSession(
  options: OpencodeOptions,
  onMessage: (message: ChatMessage) => void
): OpencodeSession {
  return new OpencodeSession(options, onMessage);
}
