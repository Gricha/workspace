import type { Subprocess, Terminal } from 'bun';
import type { TerminalSize } from './types';

export interface BaseTerminalOptions {
  shell?: string;
  size?: TerminalSize;
}

export interface SpawnConfig {
  command: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export abstract class BaseTerminalSession {
  protected process: Subprocess<'ignore', 'ignore', 'ignore'> | null = null;
  protected terminal: Terminal | null = null;
  protected shell: string;
  protected size: TerminalSize;
  private onData: ((data: Buffer) => void) | null = null;
  private onExit: ((code: number | null) => void) | null = null;

  constructor(shell: string, size?: TerminalSize) {
    this.shell = shell;
    this.size = size || { cols: 80, rows: 24 };
  }

  protected abstract getSpawnConfig(): SpawnConfig;

  start(): void {
    if (this.process) {
      throw new Error('Terminal session already started');
    }

    const config = this.getSpawnConfig();

    this.process = Bun.spawn(config.command, {
      cwd: config.cwd,
      env: config.env,
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
