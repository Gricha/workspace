import { BaseTerminalSession, type SpawnConfig } from './base-handler';
import type { TerminalOptions } from './types';

export class TerminalSession extends BaseTerminalSession {
  private containerName: string;
  private user: string;

  constructor(options: TerminalOptions) {
    super(options.shell || '/bin/bash', options.size);
    this.containerName = options.containerName;
    this.user = options.user || 'workspace';
  }

  protected getSpawnConfig(): SpawnConfig {
    return {
      command: [
        'docker',
        'exec',
        '-it',
        '-u',
        this.user,
        '-e',
        'TERM=xterm-256color',
        this.containerName,
        this.shell,
        '-l',
      ],
    };
  }
}

export function createTerminalSession(options: TerminalOptions): TerminalSession {
  return new TerminalSession(options);
}
