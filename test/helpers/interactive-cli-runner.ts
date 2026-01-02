import { spawn } from 'child_process';
import path from 'path';

export interface InteractiveCLIResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export const TERMINAL_KEYS = {
  ENTER: '\r',
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  RIGHT: '\x1b[C',
  LEFT: '\x1b[D',
  SPACE: ' ',
  BACKSPACE: '\b',
  DELETE: '\x1b[3~',
  TAB: '\t',
  CTRL_C: '\x03',
  CTRL_D: '\x04',
  HOME: '\x1b[H',
  END: '\x1b[F',
  PAGE_UP: '\x1b[5~',
  PAGE_DOWN: '\x1b[6~',
};

const BIN_PATH = path.join(__dirname, '../../dist/index.js');
const DEFAULT_TIMEOUT = 10000;

interface InteractiveOptions {
  timeout?: number;
  delayBetweenInputs?: number;
  env?: Record<string, string>;
}

export async function runInteractiveCLI(
  args: string[],
  inputs: (string | { text: string; delay?: number })[],
  options: InteractiveOptions = {}
): Promise<InteractiveCLIResult> {
  const { timeout = DEFAULT_TIMEOUT, delayBetweenInputs = 50, env } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [BIN_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const stdin = proc.stdin;
    if (!stdin) {
      reject(new Error('Could not get stdin'));
      return;
    }

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Interactive CLI timed out after ${timeout}ms`));
    }, timeout);

    try {
      inputs.forEach((input, index) => {
        const inputStr = typeof input === 'string' ? input : input.text;
        const inputDelay =
          typeof input === 'string' ? delayBetweenInputs : input.delay || delayBetweenInputs;

        setTimeout(
          () => {
            if (!stdin.destroyed) {
              stdin.write(inputStr);
            }
          },
          inputDelay * (index + 1)
        );
      });

      setTimeout(
        () => {
          if (!stdin.destroyed) {
            stdin.end();
          }
        },
        delayBetweenInputs * (inputs.length + 1)
      );
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function withEnter(texts: string[]): string[] {
  return texts.flatMap((text) => [text, TERMINAL_KEYS.ENTER]);
}

export function stripANSI(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function hasText(output: string, text: string, ignoreCase = true): boolean {
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const outputText = ignoreCase ? stripANSI(output).toLowerCase() : stripANSI(output);
  return outputText.includes(searchText);
}

export async function runPromptCLI(
  args: string[],
  responses: string[],
  options?: InteractiveOptions
): Promise<InteractiveCLIResult> {
  const inputs = withEnter(responses);
  return runInteractiveCLI(args, inputs, options);
}

export async function runMenuCLI(
  args: string[],
  selectIndex: number,
  options?: InteractiveOptions
): Promise<InteractiveCLIResult> {
  const inputs: string[] = [];
  for (let i = 0; i < selectIndex; i++) {
    inputs.push(TERMINAL_KEYS.DOWN);
  }
  inputs.push(TERMINAL_KEYS.ENTER);
  return runInteractiveCLI(args, inputs, options);
}

export function extractLines(output: string): string[] {
  return stripANSI(output)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function findLine(output: string, pattern: RegExp | string): string | null {
  const lines = extractLines(output);
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return lines.find((line) => regex.test(line)) || null;
}
