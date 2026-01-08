import type {
  AgentSyncProvider,
  SyncContext,
  SyncFile,
  SyncDirectory,
  GeneratedConfig,
} from '../types';

export const codexSync: AgentSyncProvider = {
  getRequiredDirs(): string[] {
    return ['/home/workspace/.codex'];
  },

  async getFilesToSync(_context: SyncContext): Promise<SyncFile[]> {
    return [
      {
        source: '~/.codex/auth.json',
        dest: '/home/workspace/.codex/auth.json',
        category: 'credential',
        permissions: '600',
        optional: true,
      },
      {
        source: '~/.codex/config.toml',
        dest: '/home/workspace/.codex/config.toml',
        category: 'preference',
        permissions: '600',
        optional: true,
      },
    ];
  },

  async getDirectoriesToSync(_context: SyncContext): Promise<SyncDirectory[]> {
    return [];
  },

  async getGeneratedConfigs(_context: SyncContext): Promise<GeneratedConfig[]> {
    return [];
  },
};
