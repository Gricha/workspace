import type { Subprocess, Terminal } from 'bun';
import type { TerminalSize } from './types';
import { homedir } from 'os';

export interface HostTerminalOptions {
  shell?: string;
  size?: TerminalSize;
  workDir?: string;
}

export class HostTerminalSession {
  private process: Subprocess<'ignore', 'ignore', 'ignore'> | null = null;
  private terminal: Terminal | null = null;
  private shell: string;
  private size: TerminalSize;
  private workDir: string;
  private onData: ((data: Buffer) => void) | null = null;
  private onExit: ((code: number | null) => void) | null = null;

  constructor(options: HostTerminalOptions = {}) {
    this.shell = options.shell || process.env.SHELL || '/bin/bash';
    this.size = options.size || { cols: 80, rows: 24 };
    this.workDir = options.workDir || homedir();
  }

  start(): void {
    if (this.process) {
      throw new Error('Terminal session already started');
    }

    this.process = Bun.spawn([this.shell, '-l'], {
      cwd: this.workDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
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

export function createHostTerminalSession(options?: HostTerminalOptions): HostTerminalSession {
  return new HostTerminalSession(options);
}
