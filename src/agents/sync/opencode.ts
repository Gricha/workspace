import type {
  AgentSyncProvider,
  SyncContext,
  SyncFile,
  SyncDirectory,
  GeneratedConfig,
} from '../types';
import { DEFAULT_OPENCODE_MODEL } from '../../shared/constants';

export const opencodeSync: AgentSyncProvider = {
  getRequiredDirs(): string[] {
    return ['/home/workspace/.config/opencode'];
  },

  async getFilesToSync(_context: SyncContext): Promise<SyncFile[]> {
    return [];
  },

  async getDirectoriesToSync(_context: SyncContext): Promise<SyncDirectory[]> {
    return [];
  },

  async getGeneratedConfigs(context: SyncContext): Promise<GeneratedConfig[]> {
    const zenToken = context.agentConfig.agents?.opencode?.zen_token;
    if (!zenToken) {
      return [];
    }

    const hostConfigContent = await context.readHostFile('~/.config/opencode/opencode.json');

    let mcpConfig: Record<string, unknown> = {};
    let hostModel: string | undefined;

    if (hostConfigContent) {
      try {
        const parsed = JSON.parse(hostConfigContent);
        if (parsed.mcp && typeof parsed.mcp === 'object') {
          mcpConfig = parsed.mcp;
        }
        if (typeof parsed.model === 'string' && parsed.model.trim().length > 0) {
          hostModel = parsed.model.trim();
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const configuredModel = context.agentConfig.agents?.opencode?.model?.trim();
    const model = configuredModel || hostModel || DEFAULT_OPENCODE_MODEL;

    const config: Record<string, unknown> = {
      provider: {
        opencode: {
          options: {
            apiKey: zenToken,
          },
        },
      },
      model,
    };

    if (Object.keys(mcpConfig).length > 0) {
      config.mcp = mcpConfig;
    }

    return [
      {
        dest: '/home/workspace/.config/opencode/opencode.json',
        content: JSON.stringify(config, null, 2),
        permissions: '600',
        category: 'credential',
      },
    ];
  },
};
