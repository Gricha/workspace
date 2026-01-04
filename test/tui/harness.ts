import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export interface TuiTestHarness {
  output: string;
  send(text: string): void;
  sendKey(key: 'enter' | 'escape' | 'up' | 'down' | 'left' | 'right' | 'tab' | 'backspace'): void;
  sendCtrl(key: string): void;
  waitForText(pattern: string | RegExp, timeout?: number): Promise<void>;
  waitFor(ms: number): Promise<void>;
  close(): Promise<number>;
}

const KEY_CODES: Record<string, string> = {
  enter: '\r',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  tab: '\t',
  backspace: '\x7f',
};

export async function createTuiHarness(
  command: string,
  args: string[] = [],
  options: { env?: Record<string, string>; cwd?: string; timeout?: number } = {}
): Promise<TuiTestHarness> {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 30000;

  const proc = spawn(command, args, {
    cwd,
    env: { ...process.env, ...options.env, TERM: 'xterm-256color' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';
  let closed = false;

  proc.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
  });

  proc.stderr?.on('data', (data: Buffer) => {
    output += data.toString();
  });

  proc.on('close', () => {
    closed = true;
  });

  const harness: TuiTestHarness = {
    get output() {
      return output;
    },

    send(text: string) {
      if (!closed && proc.stdin) {
        proc.stdin.write(text);
      }
    },

    sendKey(key) {
      const code = KEY_CODES[key];
      if (code) {
        this.send(code);
      }
    },

    sendCtrl(key: string) {
      const charCode = key.toUpperCase().charCodeAt(0) - 64;
      if (charCode >= 0 && charCode <= 31) {
        this.send(String.fromCharCode(charCode));
      }
    },

    async waitForText(pattern: string | RegExp, waitTimeout = timeout): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < waitTimeout) {
        if (typeof pattern === 'string') {
          if (output.includes(pattern)) return;
        } else {
          if (pattern.test(output)) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(
        `Timeout waiting for pattern: ${pattern}\nCurrent output:\n${output.slice(-1000)}`
      );
    },

    async waitFor(ms: number): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },

    async close(): Promise<number> {
      return new Promise((resolve) => {
        if (closed) {
          resolve(proc.exitCode || 0);
          return;
        }
        proc.on('close', (code) => {
          resolve(code || 0);
        });
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!closed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      });
    },
  };

  return harness;
}

export async function createTestConfigDir(workerUrl?: string): Promise<string> {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-tui-test-'));

  if (workerUrl) {
    const clientConfig = { worker: workerUrl };
    await fs.writeFile(path.join(configDir, 'client.json'), JSON.stringify(clientConfig, null, 2));
  }

  return configDir;
}

export async function cleanupTestConfigDir(configDir: string): Promise<void> {
  try {
    await fs.rm(configDir, { recursive: true, force: true });
  } catch {}
}

export async function startTuiTest(
  workerUrl?: string
): Promise<TuiTestHarness & { configDir: string }> {
  const configDir = await createTestConfigDir(workerUrl);
  const tuiPath = path.join(process.cwd(), 'dist/index.js');

  const env: Record<string, string> = {
    WS_CONFIG_DIR: configDir,
  };

  const harness = await createTuiHarness('bun', ['run', tuiPath], { env });

  return {
    ...harness,
    configDir,
    async close() {
      const exitCode = await harness.close();
      await cleanupTestConfigDir(configDir);
      return exitCode;
    },
  };
}
