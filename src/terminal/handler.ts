import type { Subprocess, Terminal } from 'bun';
import type { TerminalOptions, TerminalSize } from './types';

export class TerminalSession {
  private process: Subprocess<'ignore', 'ignore', 'ignore'> | null = null;
  private terminal: Terminal | null = null;
  private containerName: string;
  private user: string;
  private shell: string;
  private size: TerminalSize;
  private onData: ((data: Buffer) => void) | null = null;
  private onExit: ((code: number | null) => void) | null = null;

  constructor(options: TerminalOptions) {
    this.containerName = options.containerName;
    this.user = options.user || 'workspace';
    this.shell = options.shell || '/bin/bash';
    this.size = options.size || { cols: 80, rows: 24 };
  }

  start(): void {
    if (this.process) {
      throw new Error('Terminal session already started');
    }

    const args = [
      'exec',
      '-it',
      '-u',
      this.user,
      '-e',
      `TERM=xterm-256color`,
      this.containerName,
      this.shell,
      '-l',
    ];

    this.process = Bun.spawn(['docker', ...args], {
      terminal: {
        cols: this.size.cols,
        rows: this.size.rows,
        data: (_terminal: Terminal, chunk: Uint8Array) => {
          if (this.onData) {
            this.onData(Buffer.from(chunk));
          }
        },
      },
    });

    this.terminal = this.process.terminal!;

    this.process.exited.then((code) => {
      this.process = null;
      this.terminal = null;
      if (this.onExit) {
        this.onExit(code);
      }
    });
  }

  write(data: Buffer | string): void {
    if (!this.terminal) {
      return;
    }
    this.terminal.write(data.toString());
  }

  resize(size: TerminalSize): void {
    this.size = size;
    if (!this.terminal) {
      return;
    }
    this.terminal.resize(size.cols, size.rows);
  }

  setOnData(callback: (data: Buffer) => void): void {
    this.onData = callback;
  }

  setOnExit(callback: (code: number | null) => void): void {
    this.onExit = callback;
  }

  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.terminal = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}

export function createTerminalSession(options: TerminalOptions): TerminalSession {
  return new TerminalSession(options);
}
