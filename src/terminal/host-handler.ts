import { BaseTerminalSession, type SpawnConfig } from './base-handler';
import type { TerminalSize } from './types';
import { homedir } from 'os';

export interface HostTerminalOptions {
  shell?: string;
  size?: TerminalSize;
  workDir?: string;
}

export class HostTerminalSession extends BaseTerminalSession {
  private workDir: string;

  constructor(options: HostTerminalOptions = {}) {
    super(options.shell || process.env.SHELL || '/bin/bash', options.size);
    this.workDir = options.workDir || homedir();
  }

  protected getSpawnConfig(): SpawnConfig {
    return {
      command: [this.shell, '-l'],
      cwd: this.workDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    };
  }
}

export function createHostTerminalSession(options?: HostTerminalOptions): HostTerminalSession {
  return new HostTerminalSession(options);
}
