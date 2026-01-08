import { spawnSync } from 'child_process';
import { BaseTerminalSession, type SpawnConfig } from './base-handler';
import type { TerminalOptions } from './types';

function shellExistsInContainer(containerName: string, shell: string): boolean {
  const result = spawnSync('docker', ['exec', containerName, 'test', '-x', shell], {
    timeout: 5000,
  });
  return result.status === 0;
}

function resolveShell(containerName: string, preferred?: string): string {
  const fallback = '/bin/bash';
  if (!preferred) return fallback;
  if (shellExistsInContainer(containerName, preferred)) return preferred;
  return fallback;
}

export class TerminalSession extends BaseTerminalSession {
  private containerName: string;
  private user: string;

  constructor(options: TerminalOptions) {
    const shell = resolveShell(options.containerName, options.shell);
    super(shell, options.size);
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
