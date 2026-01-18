import { spawn } from 'child_process';
import type { ModelInfo } from './cache';
import type { AgentConfig } from '../shared/types';

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and capable', provider: 'anthropic' },
  { id: 'opus', name: 'Opus', description: 'Most capable', provider: 'anthropic' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest', provider: 'anthropic' },
];


export async function discoverClaudeCodeModels(config: AgentConfig): Promise<ModelInfo[]> {
  void config;
  return FALLBACK_CLAUDE_MODELS;
}

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });
  });
}

function parseOpencodeModels(output: string): ModelInfo[] {
  const models: ModelInfo[] = [];
  const lines = output.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('{')) continue;

    const parts = trimmed.split('/');
    const id = trimmed;
    const provider = parts.length > 1 ? parts[0] : undefined;
    const modelName = parts.length > 1 ? parts[1] : parts[0];
    const displayName = modelName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    models.push({
      id,
      name: displayName,
      provider,
    });
  }

  return models;
}

export function shouldUseCachedOpencodeModels(
  cached: ModelInfo[] | null,
  prefersWorkspaceModels: boolean,
  workspaceName?: string
): cached is ModelInfo[] {
  if (!cached || cached.length === 0) return false;
  if (workspaceName) return true;
  if (!prefersWorkspaceModels) return true;
  return cached.some((model) => model.provider === 'opencode' || model.id.startsWith('opencode/'));
}

export async function discoverHostOpencodeModels(): Promise<ModelInfo[]> {
  try {
    const output = await runCommand('opencode', ['models']);
    return parseOpencodeModels(output);
  } catch {
    return [];
  }
}

export async function discoverContainerOpencodeModels(
  containerName: string,
  execInContainer: (
    name: string,
    command: string[]
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>
): Promise<ModelInfo[]> {
  try {
    const result = await execInContainer(containerName, ['opencode', 'models']);
    if (result.exitCode !== 0) {
      return [];
    }
    return parseOpencodeModels(result.stdout);
  } catch {
    return [];
  }
}

export { FALLBACK_CLAUDE_MODELS, parseOpencodeModels };
