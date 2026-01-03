import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_CONFIG_DIR, CONFIG_FILE, DEFAULT_PORT, type AgentConfig } from '../shared/types';

export function getConfigDir(configDir?: string): string {
  return configDir || process.env.WS_CONFIG_DIR || DEFAULT_CONFIG_DIR;
}

export async function ensureConfigDir(configDir?: string): Promise<void> {
  const dir = getConfigDir(configDir);
  await fs.mkdir(dir, { recursive: true });
}

export function createDefaultAgentConfig(): AgentConfig {
  return {
    port: DEFAULT_PORT,
    credentials: {
      env: {},
      files: {},
    },
    scripts: {},
    agents: {},
  };
}

export async function loadAgentConfig(configDir?: string): Promise<AgentConfig> {
  const dir = getConfigDir(configDir);
  const configPath = path.join(dir, CONFIG_FILE);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      port: config.port || DEFAULT_PORT,
      credentials: {
        env: config.credentials?.env || {},
        files: config.credentials?.files || {},
      },
      scripts: config.scripts || {},
      agents: config.agents || {},
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDefaultAgentConfig();
    }
    throw err;
  }
}

export async function saveAgentConfig(config: AgentConfig, configDir?: string): Promise<void> {
  const dir = getConfigDir(configDir);
  await ensureConfigDir(dir);
  const configPath = path.join(dir, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || '', filePath.slice(2));
  }
  return filePath;
}
