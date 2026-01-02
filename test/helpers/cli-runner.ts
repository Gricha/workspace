import { spawn } from 'child_process';
import path from 'path';

export interface CLIResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const BIN_PATH = path.join(__dirname, '../../dist/index.js');
const DEFAULT_TIMEOUT = 10000;

export async function runCLI(
  args: string[],
  options: { timeout?: number; env?: Record<string, string> } = {}
): Promise<CLIResult> {
  const { timeout = DEFAULT_TIMEOUT, env } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [BIN_PATH, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
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

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`CLI command timed out after ${timeout}ms: ${args.join(' ')}`));
    }, timeout);

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

export function stripANSI(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function hasText(output: string, text: string, ignoreCase = true): boolean {
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const outputText = ignoreCase ? stripANSI(output).toLowerCase() : stripANSI(output);
  return outputText.includes(searchText);
}

export function expectText(output: string, text: string): void {
  if (!hasText(output, text)) {
    throw new Error(`Expected output to contain "${text}"\n\nActual output:\n${stripANSI(output)}`);
  }
}

export function expectNotText(output: string, text: string): void {
  if (hasText(output, text)) {
    throw new Error(
      `Expected output NOT to contain "${text}"\n\nActual output:\n${stripANSI(output)}`
    );
  }
}

export async function runCLIExpecting(
  args: string[],
  expectedInStdout: string | string[],
  options: { timeout?: number } = {}
): Promise<CLIResult> {
  const result = await runCLI(args, options);

  const expected = Array.isArray(expectedInStdout) ? expectedInStdout : [expectedInStdout];
  for (const text of expected) {
    expectText(result.stdout, text);
  }

  return result;
}

export async function runCLIExpectingError(
  args: string[],
  expectedInStderr?: string | string[],
  options: { timeout?: number } = {}
): Promise<CLIResult> {
  const result = await runCLI(args, options);

  if (result.code === 0) {
    throw new Error(`Expected CLI to fail but it succeeded:\n${stripANSI(result.stdout)}`);
  }

  if (expectedInStderr) {
    const expected = Array.isArray(expectedInStderr) ? expectedInStderr : [expectedInStderr];
    for (const text of expected) {
      expectText(result.stderr, text);
    }
  }

  return result;
}
